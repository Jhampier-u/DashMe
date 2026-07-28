// Métricas de cumplimiento. Todo aquí es puro: recibe datos ya cargados y
// devuelve números. Las consultas viven en lib/home.ts.

import { addDays, isoFromDayKey } from "./day";
import { isScheduledOn, sanitizeSchedule } from "./streak";

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

export type HabitRow = {
  id: string;
  schedule: string;
  /** Clave del día en que se creó el hábito. */
  createdKey: Date;
};

/**
 * Desde cuándo cuenta cada hábito: su creación o su registro más antiguo, lo
 * que sea anterior. Rellenar días hacia atrás no debe dejarlos fuera del
 * denominador.
 */
export function buildHabitSpecs(habits: HabitRow[], logs: LogEntry[]): HabitSpec[] {
  const earliest = new Map<string, number>();
  for (const entry of logs) {
    const t = entry.day.getTime();
    const previous = earliest.get(entry.habitId);
    if (previous === undefined || t < previous) earliest.set(entry.habitId, t);
  }

  return habits.map((h) => {
    const first = earliest.get(h.id);
    const created = h.createdKey.getTime();
    return {
      id: h.id,
      schedule: sanitizeSchedule(h.schedule),
      since: new Date(first === undefined ? created : Math.min(created, first)),
    };
  });
}

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
  /** Días con algo programado dentro del periodo actual. */
  currentDays: number;
  previous: number | null;
  /** Días con algo programado dentro del periodo anterior. */
  previousDays: number;
  /** Diferencia en puntos porcentuales, redondeada. */
  deltaPoints: number | null;
};

function countMeasured(days: DayCompliance[]): number {
  return days.filter((d) => d.rate !== null).length;
}

/**
 * Compara los últimos `periodDays` días con los `periodDays` anteriores.
 * Se usan 28 días (cuatro semanas exactas) para que ambos periodos tengan la
 * misma composición de días de la semana.
 *
 * El periodo anterior solo se compara si tiene al menos la mitad de días
 * medidos que el actual: si no, el promedio saldría de un puñado de días y la
 * comparación afirmaría más de lo que sabe.
 */
export function periodDelta(
  days: DayCompliance[],
  periodDays: number,
): PeriodDelta | null {
  const currentSlice = days.slice(-periodDays);
  const current = averageRate(currentSlice);
  if (current === null) return null;

  const currentDays = countMeasured(currentSlice);
  const previousSlice = days.slice(-periodDays * 2, -periodDays);
  const previousDays = countMeasured(previousSlice);

  const comparable = previousDays >= Math.max(1, Math.ceil(currentDays / 2));
  const previous = comparable ? averageRate(previousSlice) : null;

  return {
    current,
    currentDays,
    previous,
    previousDays,
    deltaPoints:
      previous === null ? null : Math.round((current - previous) * 100),
  };
}

/**
 * Cumplimiento medio de cada día de la semana, indexado 0=domingo..6=sábado.
 * Un día de la semana sin ningún dato vale `null`, no cero: nunca haber medido
 * un jueves no es lo mismo que haber fallado todos los jueves.
 */
export function weekdayRates(days: DayCompliance[]): (number | null)[] {
  const sums = new Array(7).fill(0);
  const counts = new Array(7).fill(0);

  for (const d of days) {
    if (d.rate === null) continue;
    const weekday = new Date(`${d.date}T00:00:00Z`).getUTCDay();
    sums[weekday] += d.rate;
    counts[weekday] += 1;
  }

  return sums.map((sum, weekday) =>
    counts[weekday] === 0 ? null : sum / counts[weekday],
  );
}

export type WeekdayRate = { weekday: number; rate: number };

function pickWeekday(
  days: DayCompliance[],
  better: (candidate: number, current: number) => boolean,
): WeekdayRate | null {
  const rates = weekdayRates(days);
  // Bucle normal y no `forEach`: TypeScript no sigue las asignaciones hechas
  // dentro de un callback, y el estrechamiento de `picked` se rompe.
  let picked: WeekdayRate | null = null;
  for (let weekday = 0; weekday < 7; weekday++) {
    const rate = rates[weekday];
    if (rate === null) continue;
    if (picked === null || better(rate, picked.rate)) picked = { weekday, rate };
  }
  return picked;
}

/** Día de la semana con mejor tasa media de cumplimiento. */
export function bestWeekday(days: DayCompliance[]): WeekdayRate | null {
  return pickWeekday(days, (candidate, current) => candidate > current);
}

/**
 * Día de la semana con peor tasa. Sale de la misma función que el mejor: si
 * cada uno recorriera los días por su cuenta, podrían llegar a contradecirse.
 */
export function worstWeekday(days: DayCompliance[]): WeekdayRate | null {
  return pickWeekday(days, (candidate, current) => candidate < current);
}
