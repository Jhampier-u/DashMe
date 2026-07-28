import { inArray, sql } from "drizzle-orm";
import { artistGenres, streams } from "@/modules/musica/schema";
import type { StatsRange } from "./range";
import { contadas, enRango, type Db } from "./shared";

export type GenreEntry = {
  name: string;
  /** Reproducciones atribuidas a este género. */
  plays: number;
  /** Proporción sobre el total atribuido, entre 0 y 1. */
  share: number;
  /** Cuántos de tus artistas lo llevan. */
  artistas: number;
};

export type GenreBreakdown = {
  generos: GenreEntry[];
  /** Artistas del rango que tienen géneros cacheados. */
  conGeneros: number;
  /** Artistas del rango sin géneros todavía. */
  sinGeneros: number;
};

/**
 * Cuántos artistas se miran para componer el reparto de géneros.
 *
 * Consultar Last.fm por los diez mil artistas del historial no es viable, y
 * tampoco haría falta: los trescientos más escuchados cubren la inmensa
 * mayoría del tiempo. Es una aproximación, y la interfaz lo dice.
 */
export const PROFUNDIDAD = 300;

/** Cuántos géneros se le atribuyen a cada artista. */
const GENEROS_POR_ARTISTA = 3;

function parseGeneros(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Reparto de géneros del rango, ponderado por reproducciones.
 *
 * Cada artista aporta sus reproducciones a sus primeros géneros. No se divide
 * entre ellos: alguien que escucha shoegaze escucha las tres etiquetas del
 * artista a la vez, y repartir la cifra haría que los totales no sumaran nada
 * interpretable. Por eso se expone `share` sobre el total atribuido y no sobre
 * las reproducciones del rango.
 */
export async function getGenreBreakdown(
  db: Db,
  range: StatsRange,
  limite = 12,
): Promise<GenreBreakdown> {
  const top = db.all<{ key: string; plays: number }>(sql`
    SELECT
      ${streams.artistKey} AS key,
      COUNT(*)             AS plays
    FROM ${streams}
    WHERE ${enRango(range)} AND ${contadas()}
    GROUP BY ${streams.artistKey}
    ORDER BY plays DESC
    LIMIT ${PROFUNDIDAD}
  `);

  if (top.length === 0) {
    return { generos: [], conGeneros: 0, sinGeneros: 0 };
  }

  const cacheados = await db
    .select()
    .from(artistGenres)
    .where(
      inArray(
        artistGenres.artistKey,
        top.map((a) => a.key),
      ),
    );

  const porClave = new Map(
    cacheados.map((c) => [c.artistKey, parseGeneros(c.genres)]),
  );

  const acumulado = new Map<string, { plays: number; artistas: number }>();
  let conGeneros = 0;

  for (const a of top) {
    const generos = porClave.get(a.key);
    if (!generos || generos.length === 0) continue;
    conGeneros += 1;

    for (const g of generos.slice(0, GENEROS_POR_ARTISTA)) {
      const acc = acumulado.get(g) ?? { plays: 0, artistas: 0 };
      acc.plays += a.plays;
      acc.artistas += 1;
      acumulado.set(g, acc);
    }
  }

  const total = [...acumulado.values()].reduce((n, v) => n + v.plays, 0);

  const generos = [...acumulado.entries()]
    .map(([name, v]) => ({
      name,
      plays: v.plays,
      artistas: v.artistas,
      share: total === 0 ? 0 : v.plays / total,
    }))
    .sort((a, b) => b.plays - a.plays)
    .slice(0, limite);

  return { generos, conGeneros, sinGeneros: top.length - conGeneros };
}

/**
 * Artistas del rango que aún no tienen géneros en caché.
 *
 * Devuelve la clave y el nombre tal como se escribió, porque Last.fm se
 * consulta por nombre legible, no por la clave normalizada.
 */
export async function getArtistasSinGeneros(
  db: Db,
  range: StatsRange,
  limite = PROFUNDIDAD,
): Promise<{ key: string; name: string }[]> {
  return db.all<{ key: string; name: string }>(sql`
    SELECT
      ${streams.artistKey}       AS key,
      MAX(${streams.artistName}) AS name
    FROM ${streams}
    WHERE ${enRango(range)} AND ${contadas()}
      AND ${streams.artistKey} NOT IN (SELECT artist_key FROM artist_genres)
    GROUP BY ${streams.artistKey}
    ORDER BY COUNT(*) DESC
    LIMIT ${limite}
  `);
}

/** Guarda los géneros de un artista, incluso si vinieron vacíos. */
export async function guardarGeneros(
  db: Db,
  artistKey: string,
  generos: string[],
): Promise<void> {
  const valores = {
    artistKey,
    genres: JSON.stringify(generos),
    fetchedAt: Date.now(),
  };

  // Se cachea también el resultado vacío: sin esto, un artista que Last.fm no
  // conoce se reintentaría en cada pasada, para siempre.
  await db
    .insert(artistGenres)
    .values(valores)
    .onConflictDoUpdate({ target: artistGenres.artistKey, set: valores });
}
