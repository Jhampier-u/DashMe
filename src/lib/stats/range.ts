/**
 * Resolución de rangos temporales.
 *
 * Todas las consultas de estadísticas reciben un `StatsRange`. Los presets y el
 * rango libre producen la misma estructura, así que "mis top artistas entre
 * marzo y julio de 2019" no es un caso especial: es el caso general con otras
 * fechas.
 *
 * Módulo puro: sin `server-only`, sin base de datos.
 */

export type PresetId = "4w" | "6m" | "year" | "all";

export type StatsRange = {
  from: number;
  to: number;
  label: string;
  preset: PresetId | "custom";
};

const DIA_MS = 24 * 60 * 60 * 1000;

export const PRESETS: Record<PresetId, { label: string; days: number | null }> = {
  "4w": { label: "Últimas 4 semanas", days: 28 },
  "6m": { label: "Últimos 6 meses", days: 182 },
  year: { label: "Último año", days: 365 },
  all: { label: "Histórico", days: null },
};

const PRESET_POR_DEFECTO: PresetId = "4w";

export type RangeParams = {
  preset?: string;
  desde?: string;
  hasta?: string;
};

/** Convierte 'YYYY-MM-DD' a epoch ms UTC. Devuelve null si no es válida. */
function parseDia(valor: string, finDelDia: boolean): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor.trim());
  if (!m) return null;

  const [, y, mes, d] = m;
  const ts = finDelDia
    ? Date.UTC(Number(y), Number(mes) - 1, Number(d), 23, 59, 59, 999)
    : Date.UTC(Number(y), Number(mes) - 1, Number(d), 0, 0, 0, 0);

  return Number.isNaN(ts) ? null : ts;
}

function desdePreset(preset: PresetId, ahora: number): StatsRange {
  const { label, days } = PRESETS[preset];
  return {
    from: days === null ? 0 : ahora - days * DIA_MS,
    to: ahora,
    label,
    preset,
  };
}

/**
 * Un rango explícito (ambas fechas válidas) tiene prioridad sobre el preset.
 * Cualquier entrada inválida cae al preset por defecto en vez de lanzar: estos
 * valores vienen de la URL y el usuario puede escribir cualquier cosa.
 */
export function parseRange(params: RangeParams, ahora: number): StatsRange {
  if (params.desde && params.hasta) {
    const a = parseDia(params.desde, false);
    const b = parseDia(params.hasta, true);

    if (a !== null && b !== null) {
      const from = Math.min(a, b);
      const to = Math.max(a, b);
      return {
        from,
        to,
        label: `${params.desde} → ${params.hasta}`,
        preset: "custom",
      };
    }
  }

  const preset = params.preset;
  if (preset && preset in PRESETS) {
    return desdePreset(preset as PresetId, ahora);
  }

  return desdePreset(PRESET_POR_DEFECTO, ahora);
}
