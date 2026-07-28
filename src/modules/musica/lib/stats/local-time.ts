/**
 * Conversión de instantes UTC a fecha y hora en la zona horaria del usuario.
 *
 * Estos valores se precalculan al insertar cada fila de `streams` porque los
 * histogramas por hora y por día son consultas frecuentes, y convertir al vuelo
 * impediría usar índices. Además el VPS correrá en UTC: depender de la hora
 * local del proceso daría resultados distintos en cada máquina.
 *
 * Módulo puro: sin `server-only`, sin base de datos.
 */

export type LocalParts = { localDate: string; localHour: number };

/**
 * `hourCycle: "h23"` es deliberado: con `hour12: false` algunos entornos
 * devuelven "24" para la medianoche en lugar de "00".
 */
function formatterFor(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  });
}

export function localParts(ts: number, timeZone: string): LocalParts {
  const parts = formatterFor(timeZone).formatToParts(new Date(ts));

  const found: Record<string, string> = {};
  for (const part of parts) found[part.type] = part.value;

  return {
    localDate: `${found.year}-${found.month}-${found.day}`,
    localHour: Number(found.hour),
  };
}

/**
 * Lee y valida `STATS_TZ`. No hay valor por defecto a propósito.
 */
export function resolveTimeZone(env: Record<string, string | undefined>): string {
  const tz = env.STATS_TZ?.trim();
  if (!tz) {
    throw new Error(
      "STATS_TZ no está definida. Añádela a .env.local con una zona IANA, " +
        "p. ej. STATS_TZ=America/Guayaquil",
    );
  }
  try {
    formatterFor(tz).format(new Date());
  } catch {
    throw new Error(`STATS_TZ no es una zona horaria IANA válida: "${tz}"`);
  }
  return tz;
}
