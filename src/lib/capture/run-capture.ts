import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { captureState } from "@/db/schema";
import { spotifyFetchHeadless } from "@/lib/spotify-headless";
import { resolveTimeZone } from "@/lib/stats/local-time";
import { insertStreams } from "@/lib/streams";
import {
  mapRecentlyPlayed,
  type RecentlyPlayedResponse,
} from "./map-recently-played";

const FILA = 1;
const LIMITE = 50;

/** Ventana mínima entre ejecuciones automáticas, para descartar duplicadas. */
const MIN_ENTRE_EJECUCIONES_MS = 30_000;

export type CaptureResult = {
  status: "ok" | "gap" | "omitida" | "error";
  inserted: number;
  fetched: number;
  message?: string;
};

async function leerEstado() {
  const filas = await db
    .select()
    .from(captureState)
    .where(eq(captureState.id, FILA))
    .limit(1);
  return filas[0] ?? null;
}

async function guardarEstado(campos: {
  lastPlayedAt?: number | null;
  lastRunStatus: string;
  lastRunInserted?: number;
  lastError?: string | null;
  gapSuspectedAt?: number | null;
}) {
  const valores = {
    id: FILA,
    lastRunAt: Date.now(),
    lastRunStatus: campos.lastRunStatus,
    lastRunInserted: campos.lastRunInserted ?? 0,
    lastError: campos.lastError ?? null,
    ...(campos.lastPlayedAt !== undefined ? { lastPlayedAt: campos.lastPlayedAt } : {}),
    ...(campos.gapSuspectedAt !== undefined ? { gapSuspectedAt: campos.gapSuspectedAt } : {}),
  };

  await db
    .insert(captureState)
    .values(valores)
    .onConflictDoUpdate({ target: captureState.id, set: valores });
}

/**
 * Una ejecución de captura.
 *
 * @param manual Si es true, salta la protección anti-duplicados. El botón
 * "ejecutar ahora" es una acción deliberada del usuario y debe responder
 * siempre.
 */
export async function runCapture(manual = false): Promise<CaptureResult> {
  const estado = await leerEstado();

  if (
    !manual &&
    estado?.lastRunAt &&
    Date.now() - estado.lastRunAt < MIN_ENTRE_EJECUCIONES_MS
  ) {
    return {
      status: "omitida",
      inserted: 0,
      fetched: 0,
      message: "Otra ejecución acaba de correr.",
    };
  }

  try {
    const timeZone = resolveTimeZone(process.env);

    const params = new URLSearchParams({ limit: String(LIMITE) });
    if (estado?.lastPlayedAt) params.set("after", String(estado.lastPlayedAt));

    const respuesta = await spotifyFetchHeadless<RecentlyPlayedResponse>(
      `/me/player/recently-played?${params}`,
      { cache: "no-store" },
    );

    const items = respuesta.items ?? [];
    const filas = mapRecentlyPlayed(items, timeZone);
    const inserted = await insertStreams(db, filas);

    const maxTs = filas.reduce((max, f) => (f.ts > max ? f.ts : max), 0);
    const nuevoCursor = maxTs > 0 ? maxTs : (estado?.lastPlayedAt ?? null);

    // Si vinieron 50 items y TODOS eran nuevos, es probable que se hayan
    // perdido escuchas entre esta ejecución y la anterior: la ventana de la
    // API son 50 pistas y puede haberse desbordado.
    const hayHueco = items.length === LIMITE && inserted === filas.length && filas.length > 0;

    await guardarEstado({
      lastPlayedAt: nuevoCursor,
      lastRunStatus: hayHueco ? "gap" : "ok",
      lastRunInserted: inserted,
      lastError: null,
      ...(hayHueco ? { gapSuspectedAt: Date.now() } : {}),
    });

    return {
      status: hayHueco ? "gap" : "ok",
      inserted,
      fetched: items.length,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await guardarEstado({ lastRunStatus: "error", lastError: message });
    return { status: "error", inserted: 0, fetched: 0, message };
  }
}

export async function getCaptureState() {
  return leerEstado();
}
