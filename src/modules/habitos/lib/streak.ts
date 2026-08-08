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
export {
  isScheduledOn,
  sanitizeSchedule,
  DEFAULT_SCHEDULE,
} from "./calendario";

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
 * Los días fallados que una racha aguanta antes de romperse.
 *
 * UNO, y es la decisión de fondo de este archivo. Lally et al. (2010) —el mismo
 * estudio del que sale el «66 días»— dicen literalmente que saltarse una
 * oportunidad suelta NO deteriora la formación del hábito: la automaticidad
 * retoma su curva. Poner la racha a cero por un día representa como catástrofe
 * algo que la evidencia dice que es inocuo, y esa representación es justo lo que
 * dispara el efecto «qué más da» que predice el abandono.
 *
 * Es UNO por racha y no «uno cada tanto»: con «que no haya dos seguidos» se
 * podría cumplir en días alternos y mantener una racha infinita, y entonces la
 * palabra «racha» dejaría de significar nada.
 */
export const FALLOS_PERDONADOS = 1;

export type Racha = {
  /** Días cumplidos que sostienen la racha. Los perdonados NO se cuentan. */
  dias: number;
  /** Cuántos fallos ha absorbido. 0 o 1. */
  perdonados: number;
};

/**
 * Racha actual con su desglose.
 *
 * `doneKeys` son timestamps (getTime()) de claves de día cumplidas.
 * Si hoy toca pero aún no está hecho, la racha no se rompe todavía: se cuenta
 * desde el día programado anterior (tienes hasta medianoche).
 *
 * El día perdonado no SUMA a la racha —no cumpliste, y decir lo contrario sería
 * mentir sobre lo que hiciste—, pero tampoco la corta. Y se devuelve aparte para
 * que la pantalla pueda decirlo en vez de fingir que la racha está limpia.
 */
export function rachaDetallada(
  calendario: Calendario,
  doneKeys: Set<number>,
  today: Date,
  maxLookbackDays = 400,
): Racha {
  let cursor = today;
  if (!doneKeys.has(today.getTime())) {
    // hoy no cuenta (aún) — empieza por ayer, tocara o no
    cursor = addDays(today, -1);
  }
  let dias = 0;
  let perdonados = 0;
  /*
    El perdón queda EN SUSPENSO hasta que se demuestre que sostiene algo.

    Sin esto, el recorrido gastaba la gracia en el fallo que hay justo ANTES del
    comienzo de la racha —el que la empezó— y una racha impecable se anunciaba
    como «3 días, 1 perdonado». Solo cuenta como perdonado el fallo que tiene
    días cumplidos a los dos lados; si el recorrido se acaba sin encontrar otro
    cumplido, el perdón se descarta.
  */
  let enSuspenso = 0;
  for (let i = 0; i < maxLookbackDays; i++) {
    if (estaProgramado(calendario, cursor)) {
      if (doneKeys.has(cursor.getTime())) {
        dias += 1;
        perdonados += enSuspenso;
        enSuspenso = 0;
      } else if (perdonados + enSuspenso < FALLOS_PERDONADOS) {
        enSuspenso += 1;
      } else break;
    }
    cursor = addDays(cursor, -1);
  }
  /*
    Sin ningún día cumplido no hay racha que perdonar. Si no, un hábito con cero
    cumplidos devolvería `perdonados: 1` y la pantalla anunciaría un perdón por
    algo que nunca empezó.
  */
  if (dias === 0) return { dias: 0, perdonados: 0 };
  return { dias, perdonados };
}

/**
 * La racha, en un número.
 *
 * Delega en `rachaDetallada` para que no haya dos cálculos que mantener de
 * acuerdo: es la misma lección que dejó `doneToday` al separarse de `doneKeys`.
 */
export function computeStreak(
  calendario: Calendario,
  doneKeys: Set<number>,
  today: Date,
  maxLookbackDays = 400,
): number {
  return rachaDetallada(calendario, doneKeys, today, maxLookbackDays).dias;
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
  let fallos = 0;
  let cursor = from;
  let guard = 0;
  while (cursor.getTime() <= to.getTime() && guard++ < 20_000) {
    if (estaProgramado(calendario, cursor)) {
      if (doneKeys.has(cursor.getTime())) {
        running += 1;
        if (running > best) best = running;
      } else if (running > 0 && fallos < FALLOS_PERDONADOS) {
        /*
          La MISMA gracia que la racha actual, y no por simetría estética: sin
          ella la racha de hoy podría superar a la «mejor histórica», que es una
          incoherencia visible en pantalla y sin explicación posible.

          `running > 0` porque un fallo antes de empezar no gasta el perdón: no
          hay racha que sostener todavía.
        */
        fallos += 1;
      } else {
        running = 0;
        fallos = 0;
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
