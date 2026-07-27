import { prisma } from "./prisma";
import {
  addDays,
  dayKey,
  daysBetween,
  isoFromDayKey,
  normalizeDayKey,
} from "./day";
import {
  computeBestStreak,
  computeStreak,
  countScheduledDays,
  isScheduledOn,
  sanitizeSchedule,
} from "./streak";

export type HabitDetailStats = {
  totalDone: number;
  /** 0..1 sobre los días que TOCABAN en los últimos 30 (desde su creación). */
  completionRate30: number;
  doneIn30: number;
  scheduledIn30: number;
  bestStreak: number;
  currentStreak: number;
  daysSinceCreated: number;
};

const EMPTY_HABIT_STATS: HabitDetailStats = {
  totalDone: 0,
  completionRate30: 0,
  doneIn30: 0,
  scheduledIn30: 0,
  bestStreak: 0,
  currentStreak: 0,
  daysSinceCreated: 0,
};

export async function getHabitStats(habitId: string): Promise<HabitDetailStats> {
  const habit = await prisma.habit.findUnique({
    where: { id: habitId },
    include: { logs: { orderBy: { date: "asc" } } },
  });
  if (!habit) return EMPTY_HABIT_STATS;

  const today = dayKey();
  const schedule = sanitizeSchedule(habit.schedule);
  const doneKeys = new Set(habit.logs.map((l) => normalizeDayKey(l.date).getTime()));
  const createdKey = dayKey(habit.createdAt);
  const firstKey = habit.logs.length
    ? normalizeDayKey(habit.logs[0].date)
    : createdKey;
  // El historial empieza en lo más antiguo que conocemos: la creación o el
  // primer registro (que puede ser anterior si se rellenó hacia atrás).
  const historyStart = new Date(
    Math.min(firstKey.getTime(), createdKey.getTime()),
  );

  // Ventana de 30 días que nunca empieza antes de que el hábito existiera:
  // un hábito creado ayer no debería mostrar un 3% de cumplimiento.
  const windowStart = new Date(
    Math.max(addDays(today, -29).getTime(), historyStart.getTime()),
  );
  const scheduledIn30 = countScheduledDays(schedule, windowStart, today);
  let doneIn30 = 0;
  for (let cursor = windowStart; cursor <= today; cursor = addDays(cursor, 1)) {
    if (isScheduledOn(schedule, cursor) && doneKeys.has(cursor.getTime())) {
      doneIn30 += 1;
    }
  }

  return {
    totalDone: habit.logs.length,
    completionRate30: scheduledIn30 === 0 ? 0 : doneIn30 / scheduledIn30,
    doneIn30,
    scheduledIn30,
    bestStreak: computeBestStreak(schedule, doneKeys, historyStart, today),
    currentStreak: computeStreak(schedule, doneKeys, today),
    daysSinceCreated: Math.max(1, daysBetween(today, createdKey) + 1),
  };
}

export type HeatCell = {
  date: string;
  count: number;
  isFuture: boolean;
};

export type GlobalStats = {
  totalCompletions: number;
  todayCompletions: number;
  weekCompletions: number;
  bestWeekday: { weekday: number; count: number } | null;
  /** 12 columnas (semanas) × 7 filas (Dom..Sáb), la última incluye hoy. */
  weeks: HeatCell[][];
};

const WEEKDAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export function weekdayName(idx: number) {
  return WEEKDAY_NAMES[idx] ?? "?";
}

export const HEATMAP_WEEKS = 12;

export async function getGlobalStats(): Promise<GlobalStats> {
  const today = dayKey();
  // El mapa arranca en el domingo de hace 11 semanas, para que cada columna
  // sea una semana real y cada fila un día de la semana.
  const firstSunday = addDays(
    today,
    -today.getUTCDay() - (HEATMAP_WEEKS - 1) * 7,
  );

  const logs = await prisma.habitLog.findMany({
    where: { date: { gte: firstSunday } },
    select: { date: true },
  });

  const byDay = new Map<number, number>();
  const byWeekday = new Map<number, number>();
  for (const l of logs) {
    const key = normalizeDayKey(l.date);
    const t = key.getTime();
    byDay.set(t, (byDay.get(t) ?? 0) + 1);
    const wd = key.getUTCDay();
    byWeekday.set(wd, (byWeekday.get(wd) ?? 0) + 1);
  }

  const weeks: HeatCell[][] = [];
  for (let w = 0; w < HEATMAP_WEEKS; w++) {
    const week: HeatCell[] = [];
    for (let d = 0; d < 7; d++) {
      const key = addDays(firstSunday, w * 7 + d);
      week.push({
        date: isoFromDayKey(key),
        count: byDay.get(key.getTime()) ?? 0,
        isFuture: key.getTime() > today.getTime(),
      });
    }
    weeks.push(week);
  }

  let weekCompletions = 0;
  for (let i = 0; i < 7; i++) {
    weekCompletions += byDay.get(addDays(today, -i).getTime()) ?? 0;
  }

  let bestWeekday: GlobalStats["bestWeekday"] = null;
  for (const [wd, c] of byWeekday) {
    if (!bestWeekday || c > bestWeekday.count) bestWeekday = { weekday: wd, count: c };
  }

  const totalCompletions = await prisma.habitLog.count();

  return {
    totalCompletions,
    todayCompletions: byDay.get(today.getTime()) ?? 0,
    weekCompletions,
    bestWeekday,
    weeks,
  };
}
