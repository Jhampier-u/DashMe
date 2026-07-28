// Métricas de flujo de trabajo: cuánto se cierra, cuánto tarda, cuánto espera
// lo que sigue abierto. Todo aquí es puro; las consultas viven en lib/tasks.ts
// y lib/projects.ts.

import { addDays, dayKey, daysBetween, isoFromDayKey, weekdayOf } from "./day";

/** Lunes de la semana a la que pertenece una clave de día. */
export function startOfWeek(key: Date): Date {
  const weekday = weekdayOf(key); // 0 = domingo
  const backToMonday = weekday === 0 ? 6 : weekday - 1;
  return addDays(key, -backToMonday);
}

export type WeekBucket = {
  /** Lunes de la semana, en formato "YYYY-MM-DD". */
  week: string;
  count: number;
};

/**
 * Cuenta sucesos por semana de lunes a domingo, en las últimas `weeks` semanas
 * contando la actual.
 *
 * Una semana sin sucesos vale cero y no desaparece: en un recuento, cero es un
 * dato. (En la gráfica de cumplimiento es al revés — allí `null` significa "no
 * tocaba nada" y la línea se interrumpe.)
 */
export function weeklyCounts(
  dates: Date[],
  weeks: number,
  today: Date = dayKey(),
): WeekBucket[] {
  const currentMonday = startOfWeek(today);
  const firstMonday = addDays(currentMonday, -(weeks - 1) * 7);

  const counts = new Map<number, number>();
  for (const date of dates) {
    const monday = startOfWeek(dayKey(date)).getTime();
    if (monday < firstMonday.getTime() || monday > currentMonday.getTime()) {
      continue;
    }
    counts.set(monday, (counts.get(monday) ?? 0) + 1);
  }

  const out: WeekBucket[] = [];
  for (let i = 0; i < weeks; i++) {
    const monday = addDays(firstMonday, i * 7);
    out.push({
      week: isoFromDayKey(monday),
      count: counts.get(monday.getTime()) ?? 0,
    });
  }
  return out;
}

/** Mediana. `null` sobre lista vacía: cero significaría "tardan cero días". */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Días de vida de cada cosa cerrada, en días de calendario locales. Se restan
 * claves de día y no instantes: lo que se cuenta son días, no horas.
 */
export function lifetimeDays(
  items: { createdAt: Date; completedAt: Date }[],
): number[] {
  return items.map((item) =>
    daysBetween(dayKey(item.completedAt), dayKey(item.createdAt)),
  );
}

/** Días que lleva esperando lo más antiguo sin cerrar. `null` si no hay nada. */
export function oldestOpenDays(
  createdAt: Date[],
  today: Date = dayKey(),
): number | null {
  if (createdAt.length === 0) return null;
  const oldest = createdAt.reduce((a, b) => (a < b ? a : b));
  return daysBetween(today, dayKey(oldest));
}

export type PeriodChange = {
  previous: number;
  current: number;
  /** Variación porcentual redondeada. `null` cuando el anterior suma cero. */
  changePercent: number | null;
};

/**
 * Compara la suma de la segunda mitad de las semanas con la de la primera.
 *
 * `changePercent` es `null` cuando el periodo anterior suma cero: no existe el
 * porcentaje de aumento sobre nada, y cualquier número que pusiéramos ahí sería
 * inventado.
 */
export function periodChange(buckets: WeekBucket[]): PeriodChange {
  const half = Math.floor(buckets.length / 2);
  const sum = (list: WeekBucket[]) => list.reduce((n, b) => n + b.count, 0);
  const previous = sum(buckets.slice(0, half));
  const current = sum(buckets.slice(half));
  return {
    previous,
    current,
    changePercent:
      previous === 0 ? null : Math.round(((current - previous) / previous) * 100),
  };
}

/** Días de calendario transcurridos desde un instante hasta hoy. */
export function daysSince(moment: Date, today: Date = dayKey()): number {
  return daysBetween(today, dayKey(moment));
}
