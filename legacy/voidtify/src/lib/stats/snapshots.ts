import { and, desc, eq, sql } from "drizzle-orm";
import { streams, topSnapshots } from "@/db/schema";
import { contadas, type Db } from "./shared";

export type SpotifyRange = "short_term" | "medium_term" | "long_term";
export type Entidad = "artists" | "tracks";

/**
 * A qué preset nuestro se parece cada ventana de Spotify.
 *
 * Es una equivalencia aproximada y declarada: Spotify no publica cómo calcula
 * sus rangos, solo los describe como «últimas 4 semanas», «últimos 6 meses» y
 * «varios años». Comparar contra nuestro equivalente más cercano es lo único
 * honesto que se puede hacer.
 */
export const EQUIVALENCIAS: Record<
  SpotifyRange,
  { label: string; dias: number | null }
> = {
  short_term: { label: "Últimas 4 semanas", dias: 27 },
  medium_term: { label: "Últimos 6 meses", dias: 181 },
  long_term: { label: "Varios años", dias: null },
};

export type Contraste = {
  timeRange: SpotifyRange;
  label: string;
  tomadoEl: number;
  /** Orden según Spotify. */
  spotify: string[];
  /** Orden según tus reproducciones, en la ventana equivalente. */
  propio: { name: string; plays: number }[];
};

type Payload = { items?: { name?: string }[] };

function nombresDe(json: string): string[] {
  try {
    const p = JSON.parse(json) as Payload;
    return (p.items ?? [])
      .map((i) => i.name)
      .filter((n): n is string => typeof n === "string");
  } catch {
    return [];
  }
}

/**
 * Los tops que Spotify calcula, frente a los que salen de contar escuchas.
 *
 * No son la misma cosa y por eso merece la pena verlos juntos: Spotify pondera
 * con criterios que no publica —la recencia pesa mucho—, mientras que contar
 * reproducciones es literal. Que discrepen no es un error de nadie.
 */
export async function getContraste(
  db: Db,
  entidad: Entidad,
  timeRange: SpotifyRange,
  hoyLocal: string,
  limite = 10,
): Promise<Contraste | null> {
  const fila = (
    await db
      .select()
      .from(topSnapshots)
      .where(
        and(
          eq(topSnapshots.entity, entidad),
          eq(topSnapshots.timeRange, timeRange),
        ),
      )
      .orderBy(desc(topSnapshots.takenAt))
      .limit(1)
  )[0];

  if (!fila) return null;

  const { label, dias } = EQUIVALENCIAS[timeRange];

  // La ventana equivalente se calcula sobre días locales, igual que todo lo
  // demás en la app: restar días a la fecha, no milisegundos al instante.
  const desde =
    dias === null
      ? "1970-01-01"
      : new Date(Date.parse(`${hoyLocal}T00:00:00Z`) - dias * 86_400_000)
          .toISOString()
          .slice(0, 10);

  const columna =
    entidad === "artists" ? streams.artistKey : streams.trackKey;
  const nombre =
    entidad === "artists" ? streams.artistName : streams.trackName;

  const propio = db.all<{ name: string; plays: number }>(sql`
    SELECT
      MAX(${nombre}) AS name,
      COUNT(*)       AS plays
    FROM ${streams}
    WHERE ${streams.localDate} BETWEEN ${desde} AND ${hoyLocal}
      AND ${contadas()}
    GROUP BY ${columna}
    ORDER BY plays DESC
    LIMIT ${limite}
  `);

  return {
    timeRange,
    label,
    tomadoEl: fila.takenAt,
    spotify: nombresDe(fila.payloadJson).slice(0, limite),
    propio,
  };
}

/** Cuántas tomas distintas hay guardadas. Una sola no permite ver evolución. */
export async function contarTomas(db: Db): Promise<number> {
  const f = db.all<{ n: number }>(sql`
    SELECT COUNT(DISTINCT ${topSnapshots.takenAt}) AS n FROM ${topSnapshots}
  `)[0];
  return f?.n ?? 0;
}
