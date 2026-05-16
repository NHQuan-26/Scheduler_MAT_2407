"use client";

import { useState, useCallback } from "react";
import { v4 as uuidv4 } from 'uuid';

// Modular Components
import Timetable from "./components/Timetable";
import TaskSidebar from "./components/TaskSidebar";
import SchedulerHeader from "./components/SchedulerHeader";

// Shared Types & Constants
import { Lecture, Task } from "./types/scheduler";
import { initialSchedule } from "./data/fakeSchedule";

/**
 * MAIN SCHEDULER PAGE
 * Orchestrates global state, backend communication, and the primary layout.
 */

export default function Home() {
  // --- GLOBAL STATE ---
  const [schedule, setSchedule] = useState<Lecture[]>(initialSchedule);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);

  // --- INTERACTION HANDLERS ---

  // Adds a new fixed block directly on the timetable grid
  const handleAddBlock = useCallback((day: number, hour: number) => {
    // Overlap Check: Don't add if already occupied
    const isOccupied = schedule.some(lec => 
      lec.day === day && 
      ((hour >= lec.startHour && hour < lec.startHour + lec.duration))
    );
    if (isOccupied) return;

    const newBlock: Lecture = {
      id: uuidv4(),
      title: "New Fixed Block",
      day,
      startHour: hour,
      duration: 1,
      color: "#ef4444", 
      isFixed: true,
    };
    setSchedule(prev => [...prev, newBlock]);
  }, [schedule]);

  // Updates any property of an existing block (move, resize, rename)
  const handleUpdateBlock = useCallback((id: string, updates: Partial<Lecture>) => {
    setSchedule(prev => {
      const target = prev.find(l => l.id === id);
      if (!target) return prev;
      const updated = { ...target, ...updates };

      // Overlap Validation for Movement
      if (updates.day !== undefined || updates.startHour !== undefined) {
        const hasOverlap = prev.some(lec => 
          lec.id !== id &&
          lec.day === updated.day &&
          ((updated.startHour >= lec.startHour && updated.startHour < lec.startHour + lec.duration) ||
           (lec.startHour >= updated.startHour && lec.startHour < updated.startHour + updated.duration))
        );
        if (hasOverlap) return prev;
      }
      return prev.map(lec => lec.id === id ? updated : lec);
    });
  }, []);

  // Removes a block from the schedule
  const handleDeleteBlock = useCallback((id: string) => {
    setSchedule(prev => prev.filter(lec => lec.id !== id));
  }, []);

  // Adds a new flexible task to the requirements list
  const handleAddTask = (name: string, hours: number) => {
    setTasks(prev => [...prev, { id: uuidv4(), name, hours }]);
  };

  // Removes a task from the requirements list
  const handleRemoveTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  // --- BACKEND INTEGRATION ---

  // Sends requirements to the ILP engine and updates the schedule
  const handleOptimize = async () => {
    if (tasks.length === 0) {
      alert("Please add at least one flexible task to optimize.");
      return;
    }
    setIsOptimizing(true);
    try {
      // Map frontend blocks to backend expected format
      const fixedBlocks = schedule.filter(s => s.isFixed).map(s => ({
        day: s.day,
        start_hour: s.startHour,
        end_hour: s.startHour + s.duration,
        title: s.title
      }));

      const response = await fetch("http://localhost:8000/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tasks: tasks.map(t => ({ name: t.name, required_hours: t.hours })),
          fixed_blocks: fixedBlocks
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.detail || "Optimization failed");
        return;
      }

      const optimizedSchedule: Lecture[] = await response.json();
      setSchedule(optimizedSchedule);
    } catch (err) {
      console.error("Optimization connection error:", err);
      alert("Failed to connect to backend engine.");
    } finally {
      setIsOptimizing(false);
    }
  };

  // --- LAYOUT ---

  return (
    <main className="h-screen flex flex-col bg-[#050505] text-slate-200 font-sans selection:bg-blue-500/30">
      {/* Top Navigation / Header */}
      <SchedulerHeader 
        isOptimizing={isOptimizing} 
        onOptimize={handleOptimize} 
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar for Inputs */}
        <TaskSidebar 
          tasks={tasks}
          onAddTask={handleAddTask}
          onRemoveTask={handleRemoveTask}
          schedule={schedule}
          onUpdateBlock={handleUpdateBlock}
          onDeleteBlock={handleDeleteBlock}
        />

        {/* Central Timetable Grid */}
        <section className="flex-1 bg-black p-4">
          <div className="h-full rounded-2xl overflow-hidden border border-white/[0.05] shadow-2xl">
            <Timetable 
              schedule={schedule} 
              onAddBlock={handleAddBlock} 
              onUpdateBlock={handleUpdateBlock} 
              onDeleteBlock={handleDeleteBlock} 
            />
          </div>
        </section>
      </div>
    </main>
  );
}
