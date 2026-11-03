// ═══════════════════════════════════════════════════════════
// Completion statistics and habit streaks
// ═══════════════════════════════════════════════════════════

import type { Todo } from "../types";
import { parseLocalDate, shiftDate } from "./dateUtils";
import { getAgendaForDate, isOccurrenceDone, listOccurrenceStarts } from "./todoUtils";

export interface DayStat {
  date: string;
  total: number;
  done: number;
  /** After today: nothing to count yet. */
  future: boolean;
}

export interface HabitStreak {
  todo: Todo;
  /** Consecutive completed occurrences up to now. */
  current: number;
  /** Longest run in the scanned period. */
  best: number;
  /** Completed / scheduled occurrences in the scanned period. */
  done: number;
  total: number;
}

const HABIT_LOOKBACK_DAYS = 180;

const ownTodos = (todos: Todo[]) => todos.filter(todo => !todo.sourceId);

/** Each occurrence is counted once, on the day it starts. */
export const getDayStat = (todos: Todo[], date: string, today: string): DayStat => {
  const items = getAgendaForDate(ownTodos(todos), date).filter(item => item.occurrenceDate === date);
  return { date, total: items.length, done: items.filter(item => item.done).length, future: date > today };
};

/** Sunday–Saturday of the week containing `today`. */
export const getWeekStats = (todos: Todo[], today: string): DayStat[] => {
  const sunday = shiftDate(today, -parseLocalDate(today).getDay());
  return Array.from({ length: 7 }, (_, i) => getDayStat(todos, shiftDate(sunday, i), today));
};

/** Completed share of everything scheduled in the last `days` days (today included). */
export const getCompletionRate = (todos: Todo[], today: string, days: number): { done: number; total: number } => {
  let done = 0;
  let total = 0;

  for (let i = 0; i < days; i++) {
    const stat = getDayStat(todos, shiftDate(today, -i), today);
    done += stat.done;
    total += stat.total;
  }

  return { done, total };
};

/** Streaks of recurring items — a lightweight habit tracker. */
export const getHabitStreaks = (todos: Todo[], today: string): HabitStreak[] =>
  ownTodos(todos)
    .filter(todo => todo.repeat !== "none")
    .map(todo => {
      const starts = listOccurrenceStarts(todo, shiftDate(today, -HABIT_LOOKBACK_DAYS), today)
        .filter(date => date <= today);
      const flags = starts.map(date => isOccurrenceDone(todo, date));

      // Today isn't over: an unfinished occurrence today doesn't break the streak yet.
      if (starts[starts.length - 1] === today && !flags[flags.length - 1]) flags.pop();

      let current = 0;
      for (let i = flags.length - 1; i >= 0 && flags[i]; i--) current++;

      let best = 0;
      let run = 0;
      for (const flag of flags) {
        run = flag ? run + 1 : 0;
        best = Math.max(best, run);
      }

      return { todo, current, best, done: flags.filter(Boolean).length, total: flags.length };
    })
    .filter(streak => streak.total > 0)
    .sort((a, b) => b.current - a.current || b.best - a.best);
