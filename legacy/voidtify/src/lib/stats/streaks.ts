import { sql } from "drizzle-orm";
import { streams } from "@/db/schema";
import type { Db } from "./shared";

export type Streaks = {
  /** Días consecutivos que llegan hasta hoy o ayer. Cero si se rompió antes. */
  actual: number;
  maxima: number;
  maximaDesde: string | null;
  maximaHasta: string | null;
};

const DIA_MS = 24 * 60 * 60 * 1000;

/** Distancia en días de calendario entre dos fechas 'YYYY-MM-DD'. */
function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DIA_MS);
}

/**
 * Rachas de días consecutivos con al menos una escucha.
 *
 * No recibe rango: una racha es una propiedad del historial completo, y
 * recortarla a una ventana daría un número que cambia según lo que estés
 * mirando. `hoy` se pasa como argumento para que la función sea determinista y
 * testeable.
 *
 * La racha actual admite que hoy todavía no haya nada: a las nueve de la mañana
 * la racha no está rota, solo no se ha alimentado aún. Se rompe cuando la
 * última escucha es de anteayer o antes.
 */
export async function getStreaks(db: Db, hoy: string): Promise<Streaks> {
  const filas = db.all<{ dia: string }>(sql`
    SELECT DISTINCT ${streams.localDate} AS dia
    FROM ${streams}
    ORDER BY dia ASC
  `);

  if (filas.length === 0) {
    return { actual: 0, maxima: 0, maximaDesde: null, maximaHasta: null };
  }

  const dias = filas.map((f) => f.dia);

  let maxima = 1;
  let maximaDesde = dias[0];
  let maximaHasta = dias[0];

  let longitud = 1;
  let inicio = dias[0];

  for (let i = 1; i < dias.length; i++) {
    if (diasEntre(dias[i - 1], dias[i]) === 1) {
      longitud += 1;
    } else {
      longitud = 1;
      inicio = dias[i];
    }

    if (longitud > maxima) {
      maxima = longitud;
      maximaDesde = inicio;
      maximaHasta = dias[i];
    }
  }

  // La racha actual: se recorre hacia atrás desde el final.
  const ultimo = dias[dias.length - 1];
  const distanciaAHoy = diasEntre(ultimo, hoy);

  let actual = 0;
  if (distanciaAHoy === 0 || distanciaAHoy === 1) {
    actual = 1;
    for (let i = dias.length - 1; i > 0; i--) {
      if (diasEntre(dias[i - 1], dias[i]) === 1) actual += 1;
      else break;
    }
  }

  return { actual, maxima, maximaDesde, maximaHasta };
}
