"use client";

import React, { useState, useEffect } from "react";
import { Lecture, DAYS, START_HOUR, END_HOUR, ROW_HEIGHT } from "../types/scheduler";
import AppointmentBlock from "./AppointmentBlock";

/**
 * TIMETABLE COMPONENT
 * Orchestrates the grid, drop zones, current-time indicator, and event overlays.
 */

interface TimetableProps {
  schedule: Lecture[];
  onAddBlock: (day: number, hour: number) => void;
  onUpdateBlock: (id: string, updates: Partial<Lecture>) => void;
  onDeleteBlock: (id: string) => void;
}

export default function Timetable({ 
  schedule, 
  onAddBlock, 
  onUpdateBlock, 
  onDeleteBlock 
}: TimetableProps) {
  
  // STATE FOR INTERACTIONS
  const [resizing, setResizing] = useState<{ id: string, startY: number, startDuration: number } | null>(null);
  const [currentHour, setCurrentHour] = useState<number | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropPreview, setDropPreview] = useState<{ day: number, hour: number, duration: number } | null>(null);

  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

  // EFFECT: Update the current-time indicator every minute
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      if (now.getHours() >= START_HOUR && now.getHours() <= END_HOUR) {
        setCurrentHour(now.getHours() + now.getMinutes() / 60);
      } else {
        setCurrentHour(null);
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  // DRAG & DROP HANDLERS
  const handleDragStart = (e: React.DragEvent, id: string) => {
    if (resizing) { e.preventDefault(); return; }
    const lec = schedule.find(l => l.id === id);
    if (!lec) return;
    setDraggedId(id);
    e.dataTransfer.setData("application/json", JSON.stringify({ id }));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDropPreview(null);
  };

  const handleDragOver = (e: React.DragEvent, day: number, hour: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (draggedId) {
      const lec = schedule.find(l => l.id === draggedId);
      if (lec) setDropPreview({ day, hour, duration: lec.duration });
    }
  };

  const handleDrop = (e: React.DragEvent, day: number, hour: number) => {
    e.preventDefault();
    const data = e.dataTransfer.getData("application/json");
    if (data) {
      const { id } = JSON.parse(data);
      onUpdateBlock(id, { day, startHour: hour });
    }
    setDraggedId(null);
    setDropPreview(null);
  };

  // RESIZING EFFECT
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizing) return;
      const deltaY = e.clientY - resizing.startY;
      const deltaHours = Math.round(deltaY / ROW_HEIGHT);
      const newDuration = Math.max(1, resizing.startDuration + deltaHours);
      const lec = schedule.find(l => l.id === resizing.id);
      if (lec && lec.duration !== newDuration && lec.startHour + newDuration <= END_HOUR + 1) {
        onUpdateBlock(resizing.id, { duration: newDuration });
      }
    };
    const handleMouseUp = () => setResizing(null);
    if (resizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizing, onUpdateBlock, schedule]);

  return (
    <div className="relative h-full w-full overflow-auto bg-slate-950 select-none">
      <div className="min-w-[800px]">
        {/* GRID HEADER: DAY NAMES */}
        <div className="sticky top-0 z-30 grid" style={{ gridTemplateColumns: "80px repeat(7, 1fr)" }}>
          <div className="h-12 bg-slate-900 border-b border-r border-slate-800 flex items-center justify-center">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Time</span>
          </div>
          {DAYS.map((day) => (
            <div key={day} className="h-12 bg-slate-900 border-b border-slate-800 flex items-center justify-center">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">{day}</span>
            </div>
          ))}
        </div>

        {/* GRID BODY: TIME SLOTS */}
        <div className="relative">
          {hours.map((hour) => (
            <div key={hour} className="grid" style={{ gridTemplateColumns: "80px repeat(7, 1fr)" }}>
              {/* Time Label Column */}
              <div 
                className="bg-slate-900/50 border-r border-b border-slate-800 flex items-start justify-center pt-2"
                style={{ height: `${ROW_HEIGHT}px` }}
              >
                <span className="text-[11px] font-mono text-slate-500">{hour.toString().padStart(2, '0')}:00</span>
              </div>
              {/* Day Cell Columns */}
              {DAYS.map((_, dayIdx) => (
                <div
                  key={dayIdx}
                  className="border-b border-r border-slate-800/50 hover:bg-white/[0.02] transition-colors cursor-crosshair"
                  style={{ height: `${ROW_HEIGHT}px` }}
                  onClick={() => onAddBlock(dayIdx, hour)}
                  onDragOver={(e) => handleDragOver(e, dayIdx, hour)}
                  onDrop={(e) => handleDrop(e, dayIdx, hour)}
                />
              ))}
            </div>
          ))}

          {/* REAL-TIME INDICATOR LINE */}
          {currentHour !== null && (
            <div 
              className="absolute left-[80px] right-0 border-t-2 border-dashed border-blue-500/40 z-20 pointer-events-none"
              style={{ top: `${(currentHour - START_HOUR) * ROW_HEIGHT}px` }}
            >
              <div className="absolute -left-2 -top-1.5 w-3 h-3 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
            </div>
          )}

          {/* APPOINTMENTS OVERLAY LAYER */}
          <div className="absolute inset-0 pointer-events-none" style={{ left: "80px" }}>
            <div className="grid h-full w-full" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
              {DAYS.map((_, dayIdx) => (
                <div key={dayIdx} className="relative h-full">
                  
                  {/* Visual Drop Preview Ghost */}
                  {dropPreview && dropPreview.day === dayIdx && (
                    <div 
                      className="absolute left-1 right-1 rounded-lg border-2 border-dashed border-white/20 bg-white/5 z-0"
                      style={{
                        top: `${(dropPreview.hour - START_HOUR) * ROW_HEIGHT + 4}px`,
                        height: `${dropPreview.duration * ROW_HEIGHT - 8}px`
                      }}
                    />
                  )}

                  {/* Render Appointment Blocks for this day */}
                  {schedule.filter(lec => lec.day === dayIdx).map(lec => (
                    <AppointmentBlock
                      key={lec.id}
                      lec={lec}
                      isDragging={draggedId === lec.id}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onUpdate={onUpdateBlock}
                      onDelete={onDeleteBlock}
                      onStartResizing={(e, id, dur) => setResizing({ id, startY: e.clientY, startDuration: dur })}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
