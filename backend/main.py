from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
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
    day: int  # 0-6
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

DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
SLOTS_PER_DAY = 24

SLOTS_PER_DAY = 24
ALLOWED_START = 6
ALLOWED_END = 22

@app.post("/optimize", response_model=List[ScheduleItem])
def optimize_schedule(req: OptimizeRequest):
    model = cp_model.CpModel()
    
    # 1. Variables
    x = {}
    for t_idx, task in enumerate(req.tasks):
        for d in range(7):
            for s in range(SLOTS_PER_DAY):
                x[(t_idx, d, s)] = model.NewBoolVar(f"x_{t_idx}_{d}_{s}")
                
                # STRICT RANGE ENFORCEMENT
                if s < ALLOWED_START or s >= ALLOWED_END:
                    model.Add(x[(t_idx, d, s)] == 0)

    # 2. Hard Constraints
    for d in range(7):
        for s in range(SLOTS_PER_DAY):
            model.Add(sum(x[(t, d, s)] for t in range(len(req.tasks))) <= 1)
            
    blocked_slots = set()
    for fb in req.fixed_blocks:
        for s in range(fb.start_hour, fb.end_hour):
            if 0 <= s < SLOTS_PER_DAY:
                blocked_slots.add((fb.day, s))
            
    for (d, s) in blocked_slots:
        for t in range(len(req.tasks)):
            model.Add(x[(t, d, s)] == 0)

    # CRITICAL: Ensure ALL hours for ALL tasks are scheduled
    for t_idx, task in enumerate(req.tasks):
        model.Add(sum(x[(t_idx, d, s)] for d in range(7) for s in range(SLOTS_PER_DAY)) == task.required_hours)

    # 3. Objective
    block_scores = []
    
    # Block Quality (from ILP_v4)
    for t_idx in range(len(req.tasks)):
        for d in range(7):
            for s in range(ALLOWED_START, ALLOWED_END):
                current = x[(t_idx, d, s)]
                start = model.NewBoolVar(f"start_{t_idx}_{d}_{s}")
                if s == 0:
                    model.Add(start == current)
                else:
                    prev = x[(t_idx, d, s - 1)]
                    model.Add(start <= current)
                    model.Add(start <= prev.Not())
                    model.Add(start >= current - prev)

                if s + 1 < ALLOWED_END:
                    one_hour = model.NewBoolVar(f"onehour_{t_idx}_{d}_{s}")
                    next_slot = x[(t_idx, d, s + 1)]
                    model.Add(one_hour <= start)
                    model.Add(one_hour <= next_slot.Not())
                    model.Add(one_hour >= start - next_slot)
                    block_scores.append(-8 * one_hour)

                def add_n_hour_reward(n, score):
                    if s + n - 1 < ALLOWED_END:
                        bool_var = model.NewBoolVar(f"{n}hour_{t_idx}_{d}_{s}")
                        slots = [x[(t_idx, d, s + i)] for i in range(n)]
                        for slot in slots: model.Add(bool_var <= slot)
                        model.Add(bool_var <= start)
                        model.Add(bool_var >= start + sum(slots) - n)
                        block_scores.append(score * bool_var)

                add_n_hour_reward(2, 6)
                add_n_hour_reward(3, 10)
                add_n_hour_reward(4, 8)

    model.Maximize(sum(block_scores))
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 10
    status = solver.Solve(model)

    if status not in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
        raise HTTPException(status_code=400, detail="No feasible solution found. Try reducing hours or removing fixed blocks.")

    result = []
    for fb in req.fixed_blocks:
        result.append(ScheduleItem(id=str(uuid.uuid4()), title=fb.title, day=fb.day, startHour=fb.start_hour, 
                                   duration=fb.end_hour - fb.start_hour, color="#ef4444", isFixed=True))

    for t_idx, task in enumerate(req.tasks):
        for d in range(7):
            s = 0
            while s < SLOTS_PER_DAY:
                if solver.Value(x[(t_idx, d, s)]) == 1:
                    start_s = s
                    while s < SLOTS_PER_DAY and solver.Value(x[(t_idx, d, s)]) == 1:
                        s += 1
                    result.append(ScheduleItem(id=str(uuid.uuid4()), title=task.name, day=d, startHour=start_s, 
                                               duration=s - start_s, color="#3b82f6", isFixed=False))
                else:
                    s += 1
    return result
                    
    return result

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
