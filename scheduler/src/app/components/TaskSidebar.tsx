"use client";

import { useState } from "react";
import { Clock, Plus, Trash2, Calendar } from "lucide-react";
import { Task, Lecture, DAYS } from "../types/scheduler";

/**
 * TASK SIDEBAR COMPONENT
 * Manages the addition of flexible tasks and lists current fixed blocks.
 */

interface TaskSidebarProps {
  tasks: Task[];
  onAddTask: (name: string, hours: number) => void;
  onRemoveTask: (id: string) => void;
  schedule: Lecture[];
  onUpdateBlock: (id: string, updates: Partial<Lecture>) => void;
  onDeleteBlock: (id: string) => void;
}

export default function TaskSidebar({
  tasks,
  onAddTask,
  onRemoveTask,
  schedule,
  onUpdateBlock,
  onDeleteBlock
}: TaskSidebarProps) {
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskHoursStr, setNewTaskHoursStr] = useState("1");

  // Handle local form submission for adding a task
  const handleAddClick = () => {
    const hours = parseInt(newTaskHoursStr);
    if (!newTaskName.trim() || isNaN(hours) || hours <= 0) {
      alert("Please enter a valid task name and positive number of hours.");
      return;
    }
    onAddTask(newTaskName, hours);
    setNewTaskName("");
    setNewTaskHoursStr("1");
  };

  return (
    <aside className="w-80 flex-shrink-0 border-r border-white/[0.05] bg-black/20 flex flex-col">
      <div className="p-6 space-y-8 overflow-y-auto flex-1">
        
        {/* SECTION 1: FLEXIBLE TASKS INPUT */}
        <section>
          <div className="flex items-center gap-2 mb-6 text-slate-400">
            <Clock size={14} />
            <h2 className="text-[10px] font-black uppercase tracking-[0.15em]">Flexible Tasks</h2>
          </div>
          
          <div className="space-y-4">
            {/* Task Creation Form */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.05] space-y-3">
              <input
                type="text"
                placeholder="Task name"
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
                className="w-full bg-black/40 border border-white/[0.1] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500/50 text-white"
              />
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="Hours"
                    value={newTaskHoursStr}
                    onChange={(e) => setNewTaskHoursStr(e.target.value)}
                    className="w-full bg-black/40 border border-white/[0.1] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500/50 text-white"
                  />
                  <span className="absolute right-3 top-2 text-[10px] text-slate-600 font-bold uppercase">HRS</span>
                </div>
                <button 
                  onClick={handleAddClick} 
                  className="p-2 bg-white text-black rounded-lg hover:bg-slate-200 transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            {/* List of Added Tasks */}
            <div className="space-y-2">
              {tasks.map(t => (
                <div key={t.id} className="group flex items-center justify-between bg-white/[0.02] p-3 rounded-lg border border-white/[0.05] hover:bg-white/[0.04] transition-all">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{t.name}</p>
                    <p className="text-[10px] text-slate-500 font-mono">{t.hours}h requirement</p>
                  </div>
                  <button 
                    onClick={() => onRemoveTask(t.id)} 
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-600 hover:text-red-500 transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 2: FIXED BLOCKS LIST */}
        <section>
          <div className="flex items-center gap-2 mb-6 text-slate-400">
            <Calendar size={14} />
            <h2 className="text-[10px] font-black uppercase tracking-[0.15em]">Fixed Blocks</h2>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed mb-4">
            Click cells in the timetable to lock in your non-negotiable time blocks.
          </p>
          
          <div className="space-y-2">
            {schedule.filter(s => s.isFixed).map(lec => (
              <div key={lec.id} className="p-3 rounded-lg bg-red-500/[0.03] border border-red-500/20 group">
                <div className="flex justify-between items-center">
                  <input 
                    className="bg-transparent border-none focus:outline-none text-xs font-bold text-red-200 w-full"
                    value={lec.title} 
                    onChange={(e) => onUpdateBlock(lec.id, { title: e.target.value })}
                  />
                  <button 
                    onClick={() => onDeleteBlock(lec.id)} 
                    className="text-red-500/40 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
                <p className="text-[10px] text-red-500/60 font-mono uppercase">
                  {DAYS[lec.day]} • {lec.startHour}:00
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
      
      {/* Footer Status */}
      <div className="p-6 border-t border-white/[0.05] bg-black/40">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-600">
          <span>Status</span>
          <span className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
            Engine Online
          </span>
        </div>
      </div>
    </aside>
  );
}
