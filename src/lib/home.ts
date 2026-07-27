import { prisma } from "./prisma";
import { addDays, dayKey, normalizeDayKey } from "./day";
import { isCriticalDay, isScheduledOn, sanitizeSchedule } from "./streak";
import {
  bestWeekday,
  complianceSeries,
  periodDelta,
  rollingMean,
  type DayCompliance,
  type HabitSpec,
  type PeriodDelta,
  type WeekdayRate,
} from "./metrics";

/** Días de historial que se cargan de una vez; el rango se recorta en cliente. */
export const HISTORY_DAYS = 365;
/** Cuatro semanas exactas: ambos periodos tienen los mismos días de la semana. */
export const COMPARISON_DAYS = 28;
export const MEAN_WINDOW = 7;

export type PendingHabit = {
  id: string;
  name: string;
  critical: boolean;
};

export type HomeMetrics = {
  today: {
    scheduled: number;
    done: number;
    pending: PendingHabit[];
  };
  series: DayCompliance[];
  mean: (number | null)[];
  delta: PeriodDelta | null;
  best: WeekdayRate | null;
};

export async function getHomeMetrics(): Promise<HomeMetrics> {
  const today = dayKey();
  const from = addDays(today, -(HISTORY_DAYS - 1));

  const [habits, logs] = await Promise.all([
    prisma.habit.findMany({
      select: { id: true, name: true, schedule: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.habitLog.findMany({
      where: { date: { gte: from } },
      select: { habitId: true, date: true, partial: true, shielded: true },
    }),
  ]);

  const entries = logs.map((l) => ({
    habitId: l.habitId,
    day: normalizeDayKey(l.date),
    partial: l.partial,
    shielded: l.shielded,
  }));

  // Un hábito cuenta desde su creación o desde su registro más antiguo, lo que
  // sea anterior: rellenar hacia atrás no debe dejar días fuera del denominador.
  const firstLog = new Map<string, number>();
  for (const entry of entries) {
    const previous = firstLog.get(entry.habitId);
    const t = entry.day.getTime();
    if (previous === undefined || t < previous) firstLog.set(entry.habitId, t);
  }

  const specs: HabitSpec[] = habits.map((h) => {
    const created = dayKey(h.createdAt).getTime();
    const earliest = firstLog.get(h.id);
    return {
      id: h.id,
      schedule: sanitizeSchedule(h.schedule),
      since: new Date(earliest === undefined ? created : Math.min(created, earliest)),
    };
  });

  const series = complianceSeries(specs, entries, from, today);
  const mean = rollingMean(series.map((d) => d.rate), MEAN_WINDOW);

  // Días cumplidos por hábito, para reutilizar la regla de los 2 días ya
  // probada en lib/streak en vez de reimplementar "ayer".
  const keysByHabit = new Map<string, Set<number>>();
  for (const entry of entries) {
    let set = keysByHabit.get(entry.habitId);
    if (!set) {
      set = new Set();
      keysByHabit.set(entry.habitId, set);
    }
    set.add(entry.day.getTime());
  }

  const doneToday = new Set(
    entries
      .filter((e) => e.day.getTime() === today.getTime() && !e.shielded)
      .map((e) => e.habitId),
  );
  const scheduledToday = habits.filter((h) => isScheduledOn(h.schedule, today));

  return {
    today: {
      scheduled: scheduledToday.length,
      done: scheduledToday.filter((h) => doneToday.has(h.id)).length,
      pending: scheduledToday
        .filter((h) => !doneToday.has(h.id))
        .map((h) => {
          const keys = keysByHabit.get(h.id) ?? new Set<number>();
          return {
            id: h.id,
            name: h.name,
            critical: isCriticalDay(h.schedule, keys, today, keys.size > 0),
          };
        }),
    },
    series,
    mean,
    delta: periodDelta(series, COMPARISON_DAYS),
    best: bestWeekday(series.slice(-COMPARISON_DAYS * 3)),
  };
}
