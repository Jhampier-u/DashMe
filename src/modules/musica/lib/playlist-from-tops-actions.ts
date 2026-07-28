"use server";

import { db } from "@/modules/core/db";
import { requireSession } from "@/modules/musica/lib/require-session";
import { createPlaylistFromTracks } from "@/modules/musica/lib/spotify-actions";
import { parseRange } from "@/modules/musica/lib/stats/range";
import { resolveTimeZone } from "@/modules/musica/lib/stats/local-time";
import { getTopTrackUris } from "@/modules/musica/lib/stats/tops";

export type ResultadoPlaylist = {
  nombre: string;
  canciones: number;
  url: string;
  error?: string;
};

/** Tope de canciones. Cincuenta es lo que cabe en una escucha razonable. */
const MAXIMO = 50;

/**
 * Crea en Spotify una playlist con las canciones más escuchadas del rango.
 *
 * Reutiliza `createPlaylistFromTracks`, el mismo camino que usan las smart
 * playlists del proyecto: crear y rellenar ya está resuelto y probado, y
 * duplicarlo solo serviría para que las dos versiones se separaran.
 */
export async function crearPlaylistDesdeTops(
  preset?: string,
  desde?: string,
  hasta?: string,
): Promise<ResultadoPlaylist> {
  await requireSession();

  const range = parseRange(
    { preset, desde, hasta },
    Date.now(),
    resolveTimeZone(process.env),
  );

  const nombre = `Voidtify · ${range.label}`;

  try {
    const tops = await getTopTrackUris(db, range, MAXIMO);

    if (tops.length === 0) {
      return {
        nombre,
        canciones: 0,
        url: "",
        error: "No hay canciones con identificador de Spotify en este rango.",
      };
    }

    const playlist = await createPlaylistFromTracks(
      {
        name: nombre,
        description: `Tus ${tops.length} canciones más escuchadas · ${range.fromDate} a ${range.toDate}`,
        public: false,
        redirectAfter: false,
      },
      tops.map((t) => t.uri),
    );

    return {
      nombre,
      canciones: tops.length,
      url: playlist.external_urls?.spotify ?? "",
    };
  } catch (e) {
    return {
      nombre,
      canciones: 0,
      url: "",
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
