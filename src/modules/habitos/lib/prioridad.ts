import { varColor, type ColorCategorico } from "@/modules/core/ui/paleta";

/**
 * Las cuatro prioridades de una tarea. Son OPCIONALES: una tarea sin prioridad
 * no lleva punto.
 *
 * Eso es lo que hace que el punto signifique algo. Si todas las tareas llevaran
 * uno, ninguna llamaría la atención, y una señal que está siempre encendida no
 * es una señal.
 *
 * No son una tabla porque no crecen: cuatro prioridades son un sistema, ocho
 * son una lista. Añadir una quinta debe costar tocar código.
 */
export type Prioridad = "URGENT" | "HIGH" | "MEDIUM" | "LOW";

/** De más a menos urgente. El orden importa: es el del selector y el del test. */
export const PRIORIDADES: Prioridad[] = ["URGENT", "HIGH", "MEDIUM", "LOW"];

type Def = {
  label: string;
  color: ColorCategorico;
  /** Diámetro del punto en px. */
  punto: number;
};

/*
  El tamaño no es decoración.

  La regla que sostiene el sistema visual es NUNCA SOLO COLOR. Un punto que solo
  cambia de tono deja fuera a quien no distingue lavanda de coral, y esos son
  justamente Urgente y Alto. El diámetro va de 6 a 15: dos señales
  independientes por el precio de una, y sigue siendo el punto redondo pedido.

  Los cuatro son múltiplos de 3 para caer en la rejilla del sistema pixel.
*/
export const PRIORIDAD_DEFS: Record<Prioridad, Def> = {
  URGENT: { label: "Urgente", color: "lav", punto: 15 },
  HIGH: { label: "Alto", color: "coral", punto: 12 },
  MEDIUM: { label: "Medio", color: "amber", punto: 9 },
  LOW: { label: "Bajo", color: "mint", punto: 6 },
};

/**
 * Traduce lo guardado. Cae a `null` y no a una prioridad media a propósito: un
 * valor corrupto no debe inventarse una urgencia que el usuario nunca puso.
 */
export function resolvePrioridad(stored: string | null): Prioridad | null {
  if (stored === null) return null;
  return (PRIORIDADES as string[]).includes(stored)
    ? (stored as Prioridad)
    : null;
}

/** Referencia al token CSS del color, para estilos en línea. */
export function prioridadColorVar(p: Prioridad): string {
  return varColor(PRIORIDAD_DEFS[p].color);
}
