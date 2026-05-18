from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
from ortools.sat.python import cp_model
import uuid

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Task(BaseModel):
    name: str
    required_hours: int


class FixedBlock(BaseModel):
    day: int
    start_hour: int
    end_hour: int
    title: str


class OptimizeRequest(BaseModel):
    tasks: List[Task]
    fixed_blocks: List[FixedBlock]


class ScheduleItem(BaseModel):
    id: str
    title: str
    day: int
    startHour: int
    duration: int
    color: str
    isFixed: bool


SLOTS_PER_DAY = 16
HOUR_OFFSET = 6

PENALTY_LONE_BLOCK = -20
REWARD_2H_BLOCK = 4
REWARD_3H_BLOCK = 8
REWARD_4H_BLOCK = 6

# covers every possible session length — exponential so longer is always worse
# 5h=-10, 6h=-20, 7h=-40, 8h=-80, 9h=-160, 10h=-320 ...
SESSION_PENALTIES = {n: -(10 * (2 ** (n - 5))) for n in range(5, SLOTS_PER_DAY + 1)}


@app.post("/optimize", response_model=List[ScheduleItem])
def optimize_schedule(req: OptimizeRequest):
    model = cp_model.CpModel()
    num_tasks = len(req.tasks)

    # ── 1. Decision variables ─────────────────────────────────────────────────
    x = {}
    for t_idx in range(num_tasks):
        for d in range(7):
            for s in range(SLOTS_PER_DAY):
                x[(t_idx, d, s)] = model.NewBoolVar(f"x_{t_idx}_{d}_{s}")

    # ── 2. Blocked slots ──────────────────────────────────────────────────────
    blocked_slots = set()
    for fb in req.fixed_blocks:
        start = max(fb.start_hour, HOUR_OFFSET)
        end = min(fb.end_hour, HOUR_OFFSET + SLOTS_PER_DAY)
        for clock_hour in range(start, end):
            s = clock_hour - HOUR_OFFSET
            blocked_slots.add((fb.day, s))

    # ── 3. Occupied variable ──────────────────────────────────────────────────
    occupied = {}
    for d in range(7):
        for s in range(SLOTS_PER_DAY):
            occ = model.NewBoolVar(f"occ_{d}_{s}")
            if (d, s) in blocked_slots:
                model.Add(occ == 1)
            elif num_tasks == 0:
                model.Add(occ == 0)
            else:
                task_vars = [x[(t, d, s)] for t in range(num_tasks)]
                for t_var in task_vars:
                    model.Add(occ >= t_var)
                model.Add(occ <= sum(task_vars))
            occupied[(d, s)] = occ

    # ── 4. Hard constraints ───────────────────────────────────────────────────
    for d in range(7):
        for s in range(SLOTS_PER_DAY):
            model.Add(sum(x[(t, d, s)] for t in range(num_tasks)) <= 1)

    for d, s in blocked_slots:
        for t in range(num_tasks):
            model.Add(x[(t, d, s)] == 0)

    for t_idx, task in enumerate(req.tasks):
        model.Add(
            sum(x[(t_idx, d, s)] for d in range(7) for s in range(SLOTS_PER_DAY))
            == task.required_hours
        )

    # ── 5. Objective ──────────────────────────────────────────────────────────
    scores = []

    # ── 5a. Per-task block quality ────────────────────────────────────────────
    for t_idx in range(num_tasks):
        for d in range(7):
            for s in range(SLOTS_PER_DAY):
                current = x[(t_idx, d, s)]

                start_t = model.NewBoolVar(f"tstart_{t_idx}_{d}_{s}")
                if s == 0:
                    model.Add(start_t == current)
                else:
                    prev = x[(t_idx, d, s - 1)]
                    model.Add(start_t <= current)
                    model.Add(start_t + prev <= 1)
                    model.Add(start_t >= current - prev)

                # lone 1-hour block penalty — fires everywhere including last slot
                if s + 1 < SLOTS_PER_DAY:
                    lone_t = model.NewBoolVar(f"lone_{t_idx}_{d}_{s}")
                    next_slot = x[(t_idx, d, s + 1)]
                    model.Add(lone_t <= start_t)
                    model.Add(lone_t + next_slot <= 1)
                    model.Add(lone_t >= start_t - next_slot)
                    scores.append(PENALTY_LONE_BLOCK * lone_t)
                else:
                    # last slot of day always lone if occupied
                    scores.append(PENALTY_LONE_BLOCK * start_t)

                def add_n_hour_reward(n, score, s=s, t_idx=t_idx, d=d, start_t=start_t):
                    if s + n > SLOTS_PER_DAY:
                        return
                    var = model.NewBoolVar(f"tblock{n}_{t_idx}_{d}_{s}")
                    slots_in_block = [x[(t_idx, d, s + i)] for i in range(n)]
                    for slot in slots_in_block:
                        model.Add(var <= slot)
                    model.Add(var <= start_t)
                    model.Add(var >= start_t + sum(slots_in_block) - n)
                    scores.append(score * var)

                add_n_hour_reward(2, REWARD_2H_BLOCK)
                add_n_hour_reward(3, REWARD_3H_BLOCK)
                add_n_hour_reward(4, REWARD_4H_BLOCK)

    # ── 5b. Penalise every task hour placed on a day with fixed blocks ────────
    # Each task hour on a busy day risks extending an already long session.
    # Penalty scales with how many fixed hours are already on that day —
    # a day with 7 fixed hours charges much more than a day with 2.
    fixed_hours_on_day = [0] * 7
    for d, s in blocked_slots:
        fixed_hours_on_day[d] += 1

    for t_idx in range(num_tasks):
        for d in range(7):
            if fixed_hours_on_day[d] == 0:
                continue
            for s in range(SLOTS_PER_DAY):
                if (d, s) in blocked_slots:
                    continue
                # cost per task hour = 4 × number of fixed hours on this day
                # day with 7 fixed hours → -28 per task hour placed here
                # day with 2 fixed hours → -8 per task hour placed here
                cost = 4 * fixed_hours_on_day[d]
                scores.append(-cost * x[(t_idx, d, s)])

    # ── 5c. Session-level penalties (cross-task, exact length) ────────────────
    # exponential penalty — a 12h session is catastrophically expensive
    # exact length only — a 6h session fires ONLY -20, not -10 + -20
    for d in range(7):
        for s in range(SLOTS_PER_DAY):

            sess_start = model.NewBoolVar(f"sstart_{d}_{s}")
            if s == 0:
                model.Add(sess_start == occupied[(d, s)])
            else:
                prev_occ = occupied[(d, s - 1)]
                model.Add(sess_start <= occupied[(d, s)])
                model.Add(sess_start + prev_occ <= 1)
                model.Add(sess_start >= occupied[(d, s)] - prev_occ)

            for n, penalty in SESSION_PENALTIES.items():
                if s + n > SLOTS_PER_DAY:
                    continue

                exact_n = model.NewBoolVar(f"sess_exact{n}_{d}_{s}")
                window = [occupied[(d, s + i)] for i in range(n)]

                for slot in window:
                    model.Add(exact_n <= slot)
                model.Add(exact_n <= sess_start)

                if s + n < SLOTS_PER_DAY:
                    after = occupied[(d, s + n)]
                    model.Add(exact_n + after <= 1)
                    model.Add(exact_n >= sess_start + sum(window) - after - n)
                else:
                    model.Add(exact_n >= sess_start + sum(window) - n)

                scores.append(penalty * exact_n)

    model.Maximize(sum(scores))

    # ── 6. Solve ──────────────────────────────────────────────────────────────
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 10
    status = solver.Solve(model)

    if status not in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
        raise HTTPException(
            status_code=400,
            detail="No feasible solution found. Try reducing required hours or removing fixed blocks.",
        )

    # ── 7. Build response ─────────────────────────────────────────────────────
    result = []

    for fb in req.fixed_blocks:
        result.append(
            ScheduleItem(
                id=str(uuid.uuid4()),
                title=fb.title,
                day=fb.day,
                startHour=fb.start_hour,
                duration=fb.end_hour - fb.start_hour,
                color="#ef4444",
                isFixed=True,
            )
        )

    for t_idx, task in enumerate(req.tasks):
        for d in range(7):
            s = 0
            while s < SLOTS_PER_DAY:
                if solver.Value(x[(t_idx, d, s)]) == 1:
                    start_s = s
                    while s < SLOTS_PER_DAY and solver.Value(x[(t_idx, d, s)]) == 1:
                        s += 1
                    result.append(
                        ScheduleItem(
                            id=str(uuid.uuid4()),
                            title=task.name,
                            day=d,
                            startHour=start_s + HOUR_OFFSET,
                            duration=s - start_s,
                            color="#3b82f6",
                            isFixed=False,
                        )
                    )
                else:
                    s += 1

    return result


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
