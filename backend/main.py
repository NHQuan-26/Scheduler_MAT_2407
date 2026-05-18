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

WEEKEND_PENALTY = 6

SESSION_PENALTIES = {n: -(10 * (2 ** (n - 5))) for n in range(5, SLOTS_PER_DAY + 1)}


@app.post("/optimize", response_model=List[ScheduleItem])
def optimize_schedule(req: OptimizeRequest):
    model = cp_model.CpModel()
    num_tasks = len(req.tasks)

    # Decision variables
    x = {}
    for t_idx in range(num_tasks):
        for d in range(7):
            for s in range(SLOTS_PER_DAY):
                x[(t_idx, d, s)] = model.NewBoolVar(f"x_{t_idx}_{d}_{s}")

    # Fixed blocked slots
    blocked_slots = set()

    for fb in req.fixed_blocks:
        start = max(fb.start_hour, HOUR_OFFSET)
        end = min(fb.end_hour, HOUR_OFFSET + SLOTS_PER_DAY)
        for clock_hour in range(start, end):
            s = clock_hour - HOUR_OFFSET
            blocked_slots.add((fb.day, s))

    # Occupied variables
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

    # Hard constraints
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

    # Objective
    scores = []

    # Block quality
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

                # Lone 1h penalty
                if s + 1 < SLOTS_PER_DAY:
                    lone_t = model.NewBoolVar(f"lone_{t_idx}_{d}_{s}")
                    next_slot = x[(t_idx, d, s + 1)]
                    model.Add(lone_t <= start_t)
                    model.Add(lone_t + next_slot <= 1)
                    model.Add(lone_t >= start_t - next_slot)
                    scores.append(PENALTY_LONE_BLOCK * lone_t)
                else:
                    scores.append(PENALTY_LONE_BLOCK * start_t)

                # Block rewards
                def add_n_hour_reward(n, reward):

                    if s + n > SLOTS_PER_DAY:
                        return

                    block_var = model.NewBoolVar(f"block_{n}_{t_idx}_{d}_{s}")

                    slots = [x[(t_idx, d, s + i)] for i in range(n)]

                    for slot in slots:
                        model.Add(block_var <= slot)

                    model.Add(block_var <= start_t)

                    model.Add(block_var >= start_t + sum(slots) - n)

                    scores.append(reward * block_var)

                add_n_hour_reward(2, REWARD_2H_BLOCK)
                add_n_hour_reward(3, REWARD_3H_BLOCK)
                add_n_hour_reward(4, REWARD_4H_BLOCK)

    # Daily load balancing
    daily_load = {}

    for d in range(7):

        load = model.NewIntVar(0, SLOTS_PER_DAY, f"daily_load_{d}")

        model.Add(load == sum(occupied[(d, s)] for s in range(SLOTS_PER_DAY)))

        daily_load[d] = load

        scores.append(-2 * load)

        # 7+ hours
        over_6 = model.NewBoolVar(f"over6_{d}")
        model.Add(load >= 7).OnlyEnforceIf(over_6)
        model.Add(load <= 6).OnlyEnforceIf(over_6.Not())
        scores.append(-15 * over_6)

        # 9+ hours
        over_8 = model.NewBoolVar(f"over8_{d}")
        model.Add(load >= 9).OnlyEnforceIf(over_8)
        model.Add(load <= 8).OnlyEnforceIf(over_8.Not())
        scores.append(-40 * over_8)

        # 11+ hours
        over_10 = model.NewBoolVar(f"over10_{d}")
        model.Add(load >= 11).OnlyEnforceIf(over_10)
        model.Add(load <= 10).OnlyEnforceIf(over_10.Not())
        scores.append(-100 * over_10)

    # Weekend penalty
    for t_idx in range(num_tasks):
        for s in range(SLOTS_PER_DAY):

            scores.append(-WEEKEND_PENALTY * x[(t_idx, 5, s)])

            scores.append(-WEEKEND_PENALTY * x[(t_idx, 6, s)])

    # Session penalties
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

                    model.Add(exact_n >= (sess_start + sum(window) - after - n))

                else:

                    model.Add(exact_n >= (sess_start + sum(window) - n))

                scores.append(penalty * exact_n)

    model.Maximize(sum(scores))

    # Solve
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 10

    status = solver.Solve(model)

    if status not in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
        raise HTTPException(status_code=400, detail="No feasible solution found.")

    # Build response
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

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
    )
