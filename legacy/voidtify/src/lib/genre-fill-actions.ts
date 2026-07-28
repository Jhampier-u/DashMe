"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requireSession } from "@/lib/require-session";
import { getArtistTagsByName } from "@/lib/lastfm";
import { parseRange } from "@/lib/stats/range";
import { resolveTimeZone } from "@/lib/stats/local-time";
import { getArtistasSinGeneros, guardarGeneros } from "@/lib/stats/genres";

export type ResultadoRelleno = {
  pedidos: number;
  conEtiquetas: number;
  sinEtiquetas: number;
  restantes: number;
};

/**
 * Cuántos artistas se resuelven por llamada.
 *
 * El limitador de Last.fm serializa a ~4,5 peticiones por segundo, así que un
 * lote de 40 tarda unos nueve segundos. Trocearlo permite ver avance y evita
 * una petición larga expuesta a cualquier timeout intermedio.
 */
const LOTE = 40;

/**
 * Resuelve un lote de artistas sin géneros contra Last.fm.
 *
 * El cliente llama repetidamente hasta que `restantes` llegue a cero. Cada
 * llamada es independiente: si una falla, lo ya guardado se conserva.
 */
export async function rellenarGeneros(
  preset?: string,
  desde?: string,
  hasta?: string,
): Promise<ResultadoRelleno> {
  await requireSession();

  const range = parseRange(
    { preset, desde, hasta },
    Date.now(),
    resolveTimeZone(process.env),
  );

  const pendientes = await getArtistasSinGeneros(db, range);
  const lote = pendientes.slice(0, LOTE);

  let conEtiquetas = 0;

  for (const a of lote) {
    // Un fallo de red en un artista no debe abortar el lote entero.
    let etiquetas: string[] = [];
    try {
      etiquetas = await getArtistTagsByName(a.name);
    } catch {
      etiquetas = [];
    }

    await guardarGeneros(db, a.key, etiquetas);
    if (etiquetas.length > 0) conEtiquetas += 1;
  }

  revalidatePath("/");

  return {
    pedidos: lote.length,
    conEtiquetas,
    sinEtiquetas: lote.length - conEtiquetas,
    restantes: Math.max(0, pendientes.length - lote.length),
  };
}
