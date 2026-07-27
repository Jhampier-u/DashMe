// Métricas de cumplimiento. Todo aquí es puro: recibe datos ya cargados y
// devuelve números. Las consultas viven en lib/home.ts.

import { addDays, isoFromDayKey } from "./day";
import { isScheduledOn } from "./streak";

/** Cuánto suma un día marcado en modo mínimo. */
export const PARTIAL_WEIGHT = 0.5;

export type HabitSpec = {
  id: string;
  schedule: string;
  /** Primer día en que el hábito cuenta: creación o su registro más antiguo. */
  since: Date;
};

export type LogEntry = {
  habitId: string;
  day: Date;
  partial: boolean;
  shielded: boolean;
};

export type DayCompliance = {
  date: string;
  scheduled: number;
  done: number;
  shielded: number;
  /** null cuando no tocaba nada: ese día no entra en ningún promedio. */
  rate: number | null;
};

export function complianceSeries(
  habits: HabitSpec[],
  logs: LogEntry[],
  from: Date,
  to: Date,
): DayCompliance[] {
  const byDay = new Map<number, LogEntry[]>();
  for (const entry of logs) {
    const t = entry.day.getTime();
    const list = byDay.get(t);
    if (list) list.push(entry);
    else byDay.set(t, [entry]);
  }

  const out: DayCompliance[] = [];
  for (let cursor = from; cursor.getTime() <= to.getTime(); cursor = addDays(cursor, 1)) {
    const activeIds = new Set(
      habits
        .filter(
          (h) =>
            cursor.getTime() >= h.since.getTime() &&
            isScheduledOn(h.schedule, cursor),
        )
        .map((h) => h.id),
    );

    let done = 0;
    let shielded = 0;
    for (const entry of byDay.get(cursor.getTime()) ?? []) {
      if (!activeIds.has(entry.habitId)) continue;
      if (entry.shielded) {
        shielded += 1;
        continue;
      }
      done += entry.partial ? PARTIAL_WEIGHT : 1;
    }

    out.push({
      date: isoFromDayKey(cursor),
      scheduled: activeIds.size,
      done,
      shielded,
      rate: activeIds.size === 0 ? null : done / activeIds.size,
    });
  }
  return out;
}

/**
 * Media móvil de la ventana que termina en cada punto. Los huecos no cuentan;
 * si la ventana entera es hueco, el resultado también lo es.
 */
export function rollingMean(
  values: (number | null)[],
  window: number,
): (number | null)[] {
  return values.map((_, i) => {
    const slice = values
      .slice(Math.max(0, i - window + 1), i + 1)
      .filter((v): v is number => v !== null);
    if (slice.length === 0) return null;
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

/** Cumplimiento medio de los días que tenían algo programado. */
export function averageRate(days: DayCompliance[]): number | null {
  const rates = days
    .map((d) => d.rate)
    .filter((v): v is number => v !== null);
  if (rates.length === 0) return null;
  return rates.reduce((a, b) => a + b, 0) / rates.length;
}

export type PeriodDelta = {
  current: number;
  previous: number | null;
  /** Diferencia en puntos porcentuales, redondeada. */
  deltaPoints: number | null;
};

/**
 * Compara los últimos `periodDays` días con los `periodDays` anteriores.
 * Se usan 28 días (cuatro semanas exactas) para que ambos periodos tengan la
 * misma composición de días de la semana.
 */
export function periodDelta(
  days: DayCompliance[],
  periodDays: number,
): PeriodDelta | null {
  const current = averageRate(days.slice(-periodDays));
  if (current === null) return null;

  const previous = averageRate(days.slice(-periodDays * 2, -periodDays));
  return {
    current,
    previous,
    deltaPoints:
      previous === null ? null : Math.round((current - previous) * 100),
  };
}

export type WeekdayRate = { weekday: number; rate: number };

/** Día de la semana (0=domingo) con mejor tasa media de cumplimiento. */
export function bestWeekday(days: DayCompliance[]): WeekdayRate | null {
  const sums = new Array(7).fill(0);
  const counts = new Array(7).fill(0);

  for (const d of days) {
    if (d.rate === null) continue;
    const weekday = new Date(`${d.date}T00:00:00Z`).getUTCDay();
    sums[weekday] += d.rate;
    counts[weekday] += 1;
  }

  let best: WeekdayRate | null = null;
  for (let weekday = 0; weekday < 7; weekday++) {
    if (counts[weekday] === 0) continue;
    const rate = sums[weekday] / counts[weekday];
    if (!best || rate > best.rate) best = { weekday, rate };
  }
  return best;
}
