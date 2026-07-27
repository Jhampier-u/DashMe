// Métricas de flujo de trabajo: cuánto se cierra, cuánto tarda, cuánto espera
// lo que sigue abierto. Todo aquí es puro; las consultas viven en lib/tasks.ts
// y lib/projects.ts.

import { addDays, dayKey, isoFromDayKey, weekdayOf } from "./day";

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
