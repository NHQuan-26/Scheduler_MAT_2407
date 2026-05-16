/**
 * SHARED TYPE DEFINITIONS
 * These types are used across the entire application to ensure data consistency.
 */

export interface Task {
  id: string;
  name: string;
  hours: number;
}

export interface Lecture {
  id: string;
  title: string;
  day: number;
  startHour: number;
  duration: number;
  color: string;
  isFixed: boolean;
}

export interface OptimizeRequest {
  tasks: Array<{ name: string; required_hours: number }>;
  fixed_blocks: Array<{ day: number; start_hour: number; end_hour: number; title: string }>;
}

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const START_HOUR = 6;
export const END_HOUR = 21;
export const ROW_HEIGHT = 50;
