"use client";

import { GripVertical, Trash2, Lock, Unlock } from "lucide-react";
import { Lecture, START_HOUR, ROW_HEIGHT } from "../types/scheduler";

/**
 * APPOINTMENT BLOCK COMPONENT
 * Handles individual event rendering, dragging, resizing, and inline editing.
 */

interface AppointmentBlockProps {
  lec: Lecture;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
  onUpdate: (id: string, updates: Partial<Lecture>) => void;
  onDelete: (id: string) => void;
  onStartResizing: (e: React.MouseEvent, id: string, duration: number) => void;
}

export default function AppointmentBlock({
  lec,
  isDragging,
  onDragStart,
  onDragEnd,
  onUpdate,
  onDelete,
  onStartResizing
}: AppointmentBlockProps) {
  const top = (lec.startHour - START_HOUR) * ROW_HEIGHT;
  const height = lec.duration * ROW_HEIGHT;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, lec.id)}
      onDragEnd={onDragEnd}
      className={`absolute left-1 right-1 rounded-lg p-2 pointer-events-auto cursor-move shadow-lg border transition-all 
        ${isDragging ? 'z-50 border-white ring-4 ring-white/10 opacity-40 scale-95' : 'hover:z-10'} 
        group overflow-hidden bg-slate-900/40`}
      style={{
        top: `${top + 4}px`,
        height: `${height - 8}px`,
        backgroundColor: lec.isFixed ? '#ef444420' : '#3b82f620',
        borderColor: isDragging ? 'white' : (lec.isFixed ? '#ef4444' : '#3b82f6'),
        color: 'white',
        pointerEvents: isDragging ? 'none' : 'auto'
      }}
    >
      <div className="flex items-start justify-between h-full flex-col">
        {/* Header: Title Input & Delete Button */}
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <GripVertical size={12} className="text-slate-500 flex-shrink-0" />
            <input 
              className="bg-transparent border-none focus:outline-none text-xs font-bold truncate w-full cursor-text"
              value={lec.title}
              onChange={(e) => onUpdate(lec.id, { title: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              draggable={false}
            />
          </div>
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(lec.id); }}
            className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity"
          >
            <Trash2 size={12} />
          </button>
        </div>
        
        {/* Footer: Time Range & Lock Toggle */}
        <div className="flex items-center justify-between w-full mt-auto">
          <span className="text-[10px] font-mono text-slate-400">
            {lec.startHour}:00 - {lec.startHour + lec.duration}:00
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onUpdate(lec.id, { isFixed: !lec.isFixed }); }}
            className={`p-1 rounded ${lec.isFixed ? 'text-red-400' : 'text-blue-400'}`}
          >
            {lec.isFixed ? <Lock size={10} /> : <Unlock size={10} />}
          </button>
        </div>
      </div>

      {/* Resize Handle at the bottom */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize bg-white/0 hover:bg-white/10 transition-colors"
        onMouseDown={(e) => onStartResizing(e, lec.id, lec.duration)}
      />
    </div>
  );
}
