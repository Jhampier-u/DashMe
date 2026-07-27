// Manejo de "días" para Untap.
//
// Regla: un día se identifica por su fecha de calendario LOCAL del usuario,
// pero se guarda como medianoche UTC de esa fecha (una "day key").
// Así la clave es estable, comparable y libre de husos, mientras que el
// corte del día ocurre a la medianoche local — no a las 19:00 como pasaba
// cuando la fecha se derivaba de getUTCDate() sobre el instante actual.
//
// Dos funciones distintas, y la diferencia importa:
//   - dayKey(moment)       : instante real  -> clave del día local que lo contiene
//   - normalizeDayKey(val) : valor ya guardado (medianoche UTC) -> la misma clave

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Clave del día de calendario LOCAL que contiene `d`. */
export function dayKey(d: Date = new Date()): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

/** Normaliza un valor date-only leído de la BD. Idempotente. */
export function normalizeDayKey(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** "YYYY-MM-DD" -> clave, o null si no es una fecha válida. */
export function dayKeyFromISO(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const key = new Date(Date.UTC(y, m - 1, d));
  // rechaza desbordes tipo 2026-02-31
  if (
    key.getUTCFullYear() !== y ||
    key.getUTCMonth() !== m - 1 ||
    key.getUTCDate() !== d
  ) {
    return null;
  }
  return key;
}

/** Clave -> "YYYY-MM-DD". */
export function isoFromDayKey(key: Date): string {
  return key.toISOString().slice(0, 10);
}

export function addDays(key: Date, n: number): Date {
  return new Date(key.getTime() + n * MS_PER_DAY);
}

/** Días enteros entre dos claves (a - b). */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / MS_PER_DAY);
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getTime() === b.getTime();
}

/**
 * Rango de tiempo REAL [start, end) del día local que contiene `now`.
 * Para consultar campos que guardan instantes (completedAt, createdAt),
 * no claves de día.
 */
export function localDayRange(now: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0,
  );
  const end = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    0,
    0,
  );
  return { start, end };
}

/** Día de la semana (0=Dom..6=Sáb) de una clave. */
export function weekdayOf(key: Date): number {
  return key.getUTCDay();
}
