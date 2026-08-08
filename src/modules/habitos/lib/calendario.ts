import { normalizeDayKey, weekdayOf } from "./day";

/*
  El calendario de un hábito: qué días toca y qué días está en pausa.

  LA IDEA DE TODO ESTE BLOQUE: una pausa no es un estado nuevo, es otra razón
  para que un día no esté programado. Los catorce sitios que consultan el
  calendario ya saben tratar un día no programado —lo saltan, no lo cuentan y no
  lo consideran un fallo—, así que la pausa entra por esa misma puerta y no hay
  que enseñarles nada.

  Es un DATO y no una función. Un predicado `(dia) => boolean` habría sido más
  elegante y habría dejado a `streak.ts` sin saber qué es un calendario, pero
  `HabitSpec` viaja hacia las gráficas y un objeto con una función dentro deja de
  poder cruzar la frontera de servidor a cliente.
*/

export const DEFAULT_SCHEDULE = "1111111";

/*
  `sanitizeSchedule` e `isScheduledOn` VIVEN AQUÍ y no en `streak.ts`, aunque
  vinieran de allí.

  El motivo es un ciclo: `estaProgramado` necesita `isScheduledOn`, y `streak.ts`
  necesita `estaProgramado`. En ESM el ciclo funcionaría —son funciones y no se
  ejecutan al cargar— pero es frágil de leer, y basta con que alguien añada una
  constante calculada arriba para que se rompa en el arranque. `streak.ts` las
  reexporta para no romper a quien las importaba de allí.
*/

/** Normaliza un schedule a 7 chars "1"/"0". Nunca devuelve todo apagado. */
export function sanitizeSchedule(s: string | null | undefined): string {
  const cleaned = (s ?? "").replace(/[^01]/g, "").padEnd(7, "0").slice(0, 7);
  return cleaned === "0000000" ? DEFAULT_SCHEDULE : cleaned;
}

/** ¿Toca este hábito en esta clave de día, mirando SOLO el día de la semana? */
export function isScheduledOn(
  schedule: string | null | undefined,
  key: Date,
): boolean {
  return sanitizeSchedule(schedule)[weekdayOf(key)] === "1";
}

/** Rango de días, **los dos extremos incluidos**. */
export type Rango = { desde: Date; hasta: Date };

export type Calendario = {
  /** 7 caracteres dom→sáb, 1 = activo. */
  schedule: string;
  pausas: Rango[];
};

/** Atajo para componer un calendario, sobre todo en tests. */
export function cal(schedule: string, pausas: Rango[] = []): Calendario {
  return { schedule, pausas };
}

/**
 * ¿Ese día cae dentro de alguna pausa?
 *
 * Los dos extremos entran: «del 1 al 15» incluye el 1 y el 15, que es como lo
 * dice cualquiera. Dejar fuera un extremo es el clásico error de un día que nadie
 * nota hasta que le rompe una racha.
 */
export function enPausa(pausas: Rango[], dia: Date): boolean {
  const t = normalizeDayKey(dia).getTime();
  return pausas.some(
    (p) =>
      normalizeDayKey(p.desde).getTime() <= t &&
      t <= normalizeDayKey(p.hasta).getTime(),
  );
}

/**
 * ¿Ese día tocaba?
 *
 * Sin pausas es exactamente `isScheduledOn`, y de eso depende que nada cambie
 * para quien no use pausas.
 */
export function estaProgramado(calendario: Calendario, dia: Date): boolean {
  return (
    isScheduledOn(calendario.schedule, dia) && !enPausa(calendario.pausas, dia)
  );
}

/**
 * Normaliza un rango y lo endereza si viene al revés.
 *
 * Intercambiar en vez de rechazar: un rango invertido es un error de dedo, no una
 * intención, y rechazarlo obligaría al usuario a adivinar qué escribió mal cuando
 * el problema es evidente.
 */
export function corregirRango(desde: Date, hasta: Date): Rango {
  const a = normalizeDayKey(desde);
  const b = normalizeDayKey(hasta);
  return a.getTime() <= b.getTime()
    ? { desde: a, hasta: b }
    : { desde: b, hasta: a };
}
