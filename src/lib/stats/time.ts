import { sql } from "drizzle-orm";
import { streams } from "@/db/schema";
import type { StatsRange } from "./range";
import { enRango, type Db } from "./shared";

export type HourBucket = { hour: number; plays: number; ms: number };
export type WeekdayBucket = { weekday: number; plays: number; ms: number };
export type MonthBucket = { month: string; plays: number; ms: number };

/**
 * Devuelve las 24 horas siempre, rellenando con ceros.
 *
 * Un histograma al que le faltan las horas sin escuchas se dibuja mal y
 * miente visualmente: parecería que la madrugada no existe en vez de que está
 * vacía.
 */
export async function getByHour(
  db: Db,
  range: StatsRange,
): Promise<HourBucket[]> {
  const filas = db.all<{ hour: number; plays: number; ms: number }>(sql`
    SELECT
      ${streams.localHour}      AS hour,
      COUNT(*)                  AS plays,
      SUM(${streams.msPlayed})  AS ms
    FROM ${streams}
    WHERE ${enRango(range)}
    GROUP BY ${streams.localHour}
  `);

  const porHora = new Map(filas.map((f) => [f.hour, f]));

  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    plays: porHora.get(hour)?.plays ?? 0,
    ms: porHora.get(hour)?.ms ?? 0,
  }));
}

/**
 * Día de la semana con lunes = 0.
 *
 * `strftime('%w')` de SQLite devuelve domingo = 0, que no es como se lee una
 * semana en español. Se rota: `(%w + 6) % 7`.
 */
export async function getByWeekday(
  db: Db,
  range: StatsRange,
): Promise<WeekdayBucket[]> {
  const filas = db.all<{ weekday: number; plays: number; ms: number }>(sql`
    SELECT
      (CAST(strftime('%w', ${streams.localDate}) AS INTEGER) + 6) % 7 AS weekday,
      COUNT(*)                  AS plays,
      SUM(${streams.msPlayed})  AS ms
    FROM ${streams}
    WHERE ${enRango(range)}
    GROUP BY weekday
  `);

  const porDia = new Map(filas.map((f) => [f.weekday, f]));

  return Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    plays: porDia.get(weekday)?.plays ?? 0,
    ms: porDia.get(weekday)?.ms ?? 0,
  }));
}

/**
 * Un punto por mes con datos, sin rellenar los vacíos.
 *
 * Al contrario que las horas, aquí el rango es arbitrario y puede abarcar años:
 * rellenar produciría cientos de puntos a cero. Quien dibuje la gráfica decide
 * si interpola.
 */
export async function getByMonth(
  db: Db,
  range: StatsRange,
): Promise<MonthBucket[]> {
  return db.all<MonthBucket>(sql`
    SELECT
      substr(${streams.localDate}, 1, 7) AS month,
      COUNT(*)                           AS plays,
      SUM(${streams.msPlayed})           AS ms
    FROM ${streams}
    WHERE ${enRango(range)}
    GROUP BY month
    ORDER BY month ASC
  `);
}
