"use client";

import { Sparkles, LayoutGrid } from "lucide-react";

/**
 * HEADER COMPONENT
 * Displays the application title and the main optimization button.
 */

interface SchedulerHeaderProps {
  isOptimizing: boolean;
  onOptimize: () => void;
}

export default function SchedulerHeader({ isOptimizing, onOptimize }: SchedulerHeaderProps) {
  return (
    <header className="h-16 flex-shrink-0 px-6 border-b border-white/[0.05] bg-black/40 backdrop-blur-md flex justify-between items-center z-50">
      <div className="flex items-center gap-3">
        {/* App Logo/Icon */}
        <div className="p-2 bg-blue-600/20 rounded-lg border border-blue-500/20">
          <LayoutGrid size={18} className="text-blue-400" />
        </div>
        
        {/* App Title */}
        <div>
          <h1 className="text-sm font-black tracking-[0.2em] text-white uppercase">
            Scheduler <span className="text-blue-500">Demo</span>
          </h1>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
            ILP v4 Optimization Engine
          </p>
        </div>
      </div>

      {/* Optimization Action Button */}
      <button
        onClick={onOptimize}
        disabled={isOptimizing}
        className="relative px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 rounded-full text-xs font-bold transition-all flex items-center gap-2 group shadow-[0_0_30px_rgba(37,99,235,0.2)] hover:shadow-[0_0_40px_rgba(37,99,235,0.4)]"
      >
        <Sparkles 
          size={14} 
          className={isOptimizing ? "animate-spin" : "group-hover:rotate-12 transition-transform"} 
        />
        {isOptimizing ? "COMPUTING..." : "GENERATE SCHEDULE"}
      </button>
    </header>
  );
}
