import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/modules/core/db";
import { captureState } from "@/modules/musica/schema";
import { spotifyFetchHeadless } from "@/modules/musica/lib/spotify-headless";
import { resolveTimeZone } from "@/modules/musica/lib/stats/local-time";
import { insertStreams } from "@/modules/musica/lib/streams";
import {
  mapRecentlyPlayed,
  type RecentlyPlayedResponse,
} from "./map-recently-played";
import { capturarTopsSiToca } from "./top-snapshots";

const FILA = 1;
const LIMITE = 50;

/** Ventana mínima entre ejecuciones automáticas, para descartar duplicadas. */
const MIN_ENTRE_EJECUCIONES_MS = 30_000;

export type CaptureResult = {
  status: "ok" | "gap" | "omitida" | "error";
  inserted: number;
  fetched: number;
  snapshots: number;
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
  try {
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
        snapshots: 0,
        message: "Otra ejecución acaba de correr.",
      };
    }

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

    // Un fallo aquí no debe tumbar la captura de escuchas, que es lo urgente.
    let snapshots = 0;
    try {
      snapshots = await capturarTopsSiToca();
    } catch (e) {
      console.warn("[captura] no se pudieron guardar los tops", e);
    }

    const maxTs = filas.reduce((max, f) => (f.ts > max ? f.ts : max), 0);
    const nuevoCursor = maxTs > 0 ? maxTs : (estado?.lastPlayedAt ?? null);

    // Un hueco significa que la ventana de 50 se desbordó entre dos ejecuciones.
    // En la primera, sin cursor previo, todo lo que devuelve Spotify es nuevo por
    // definición: eso es una carga inicial, no una pérdida. Sin esta condición la
    // alerta se enciende el primer día y no se apaga nunca.
    const primeraEjecucion = !estado?.lastPlayedAt;
    const hayHueco =
      !primeraEjecucion &&
      items.length === LIMITE &&
      inserted === filas.length &&
      filas.length > 0;

    await guardarEstado({
      lastPlayedAt: nuevoCursor,
      lastRunStatus: hayHueco ? "gap" : "ok",
      lastRunInserted: inserted,
      lastError: null,
      // Se limpia en una ejecución sana: si no, la primera alerta legítima
      // quedaría encendida de forma permanente y dejaría de significar nada.
      gapSuspectedAt: hayHueco ? Date.now() : null,
    });

    return {
      status: hayHueco ? "gap" : "ok",
      inserted,
      fetched: items.length,
      snapshots,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // Si además falla el guardado del error, no se propaga: perderíamos el
    // error original y el cron recibiría una traza en vez de un resultado.
    try {
      await guardarEstado({ lastRunStatus: "error", lastError: message });
    } catch (e2) {
      console.error("[captura] no se pudo registrar el error", e2);
    }
    return { status: "error", inserted: 0, fetched: 0, snapshots: 0, message };
  }
}

export async function getCaptureState() {
  return leerEstado();
}
