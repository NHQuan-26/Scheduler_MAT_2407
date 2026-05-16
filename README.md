# 📅 Scheduler MAT 2407

A sophisticated, AI-powered scheduling application built for the MAT 2407 course. This project combines a high-performance **Constraint Programming (CP-SAT)** backend with a modern, interactive **Next.js** frontend to help students and professionals optimize their weekly routines.

---

## ✨ What's Cool About This Project?

- **Intelligent Optimization**: Unlike simple calendar apps, this uses Google's **OR-Tools (CP-SAT Solver)** to mathematically find the "best" schedule. It doesn't just fit things in; it optimizes for quality, preferring solid 2-4 hour blocks over fragmented schedules.
- **Sleek Aesthetic**: A high-contrast "Dark Mode" UI designed for focus, featuring glassmorphism, subtle gradients, and smooth animations.
- **Interactive UX**: Full support for **Drag & Drop** and **Real-time Resizing**. You can physically shape your day.
- **Live Indicator**: A real-time "Now" line that moves across your schedule, keeping you grounded in the present moment.
- **Strict Hard Constraints**: Ensures your fixed blocks (classes, sleep, work) are never violated while perfectly distributing your "flexible" tasks.

---

## 🛠 Tech Stack

### Backend (The Brain)

- **FastAPI**: A modern, high-performance web framework for Python.
- **OR-Tools (CP-SAT)**: Advanced mathematical optimization library by Google.
- **Pydantic**: Robust data validation and settings management.

### Frontend (The Face)

- **Next.js 15+**: React framework for the web.
- **Tailwind CSS 4**: For high-performance, utility-first styling.
- **Dnd-kit**: Lightweight and modular drag & drop primitives.
- **Lucide React**: Beautifully consistent iconography.

---

## 🚀 Getting Started

### 1. Prerequisites

- **Python 3.9+**
- **Node.js 18+**
- **pnpm** (preferred) or npm/yarn

### 2. Backend Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

The backend will run on `http://localhost:8000`.

### 3. Frontend Setup

```bash
cd scheduler
pnpm install
pnpm dev
```

The frontend will run on `http://localhost:3000`.

---

## 📖 How to Use

1. **Add Fixed Blocks**: Click on any empty slot in the timetable to add a "Fixed Block" (like a class or a job). These are treated as immovable constraints.
2. **Define Tasks**: In the left sidebar, add "Flexible Tasks" and specify how many hours per week you need for them (e.g., "Study Calculus - 10 hours").
3. **Optimize**: Click the **"Optimize Schedule"** button in the header. The backend solver will crunch the numbers and automatically populate your week with the best possible task distribution.
4. **Fine-Tune**:
   - **Drag** any block to move it to a different day or time.
   - **Resize** blocks by dragging their bottom edge to adjust duration.
   - **Delete** blocks by clicking the "×" icon on the block itself.

---

## 📐 Project Structure

```text
├── backend/            # Python FastAPI & CP-SAT Solver logic
│   └── main.py         # The optimization engine
└── scheduler/          # Next.js Frontend
    ├── src/app/        # Core application logic
    │   ├── components/ # Modular UI components
    │   ├── types/      # Shared TypeScript interfaces
    │   └── data/       # Initial state/mock data
    └── ...             # Config files (Tailwind, ESLint, Next)
```

---

## 🎓 Academic Context

Created for **MAT 2407**. This project demonstrates the practical application of **Integer Linear Programming (ILP)** and **Constraint Satisfaction Problems (CSP)** in solving real-world logistical challenges.
