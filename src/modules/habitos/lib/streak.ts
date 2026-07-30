// Cálculo de rachas — única fuente de verdad.
//
// Antes esto vivía duplicado en tres sitios (lib/habits, app/actions y
// lib/stats) con tres semánticas distintas: la tarjeta del hábito respetaba
// los días programados y las otras dos contaban días de calendario, así que
// los hitos nunca disparaban en hábitos L-M-V y el detalle mostraba una racha
// distinta a la de la tarjeta.

import { addDays } from "./day";
import { estaProgramado, type Calendario } from "./calendario";

/*
  `sanitizeSchedule` e `isScheduledOn` se han mudado a `calendario.ts`, porque
  `estaProgramado` las necesita y este archivo va a necesitar a `estaProgramado`:
  dejarlas aquí montaba un ciclo de importación.

  Se reexportan para no romper a quien las importaba de aquí, que son unos
  cuantos.
*/
export { isScheduledOn, sanitizeSchedule, DEFAULT_SCHEDULE } from "./calendario";

/** Día programado inmediatamente anterior a `from` (excluyente). */
export function previousScheduledDay(
  calendario: Calendario,
  from: Date,
  maxBackDays = 14,
): Date | null {
  for (let i = 1; i <= maxBackDays; i++) {
    const d = addDays(from, -i);
    if (estaProgramado(calendario, d)) return d;
  }
  return null;
}

/**
 * Racha actual: días programados consecutivos cumplidos, caminando hacia atrás.
 *
 * `doneKeys` son timestamps (getTime()) de claves de día cumplidas.
 * Si hoy toca pero aún no está hecho, la racha no se rompe todavía: se cuenta
 * desde el día programado anterior (tienes hasta medianoche).
 */
export function computeStreak(
  calendario: Calendario,
  doneKeys: Set<number>,
  today: Date,
  maxLookbackDays = 400,
): number {
  let cursor = today;
  if (!doneKeys.has(today.getTime())) {
    // hoy no cuenta (aún) — empieza por ayer, tocara o no
    cursor = addDays(today, -1);
  }
  let streak = 0;
  for (let i = 0; i < maxLookbackDays; i++) {
    if (estaProgramado(calendario, cursor)) {
      if (doneKeys.has(cursor.getTime())) streak += 1;
      else break;
    }
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/**
 * Mejor racha histórica, contando solo días programados entre `from` y `to`
 * (ambos inclusive).
 */
export function computeBestStreak(
  calendario: Calendario,
  doneKeys: Set<number>,
  from: Date,
  to: Date,
): number {
  let best = 0;
  let running = 0;
  let cursor = from;
  let guard = 0;
  while (cursor.getTime() <= to.getTime() && guard++ < 20_000) {
    if (estaProgramado(calendario, cursor)) {
      if (doneKeys.has(cursor.getTime())) {
        running += 1;
        if (running > best) best = running;
      } else {
        running = 0;
      }
    }
    cursor = addDays(cursor, 1);
  }
  return best;
}

/**
 * Regla de los 2 días: hoy toca, no está hecho, y el día programado anterior
 * se falló. Solo aplica si el hábito ya tiene historial.
 */
export function isCriticalDay(
  calendario: Calendario,
  doneKeys: Set<number>,
  today: Date,
  hasHistory: boolean,
): boolean {
  if (!hasHistory) return false;
  if (!estaProgramado(calendario, today)) return false;
  if (doneKeys.has(today.getTime())) return false;
  const prev = previousScheduledDay(calendario, today, 14);
  return !!prev && !doneKeys.has(prev.getTime());
}

/** Cuántos días programados hay en la ventana [from, to] inclusive. */
export function countScheduledDays(
  calendario: Calendario,
  from: Date,
  to: Date,
): number {
  let count = 0;
  let cursor = from;
  let guard = 0;
  while (cursor.getTime() <= to.getTime() && guard++ < 20_000) {
    if (estaProgramado(calendario, cursor)) count += 1;
    cursor = addDays(cursor, 1);
  }
  return count;
}
