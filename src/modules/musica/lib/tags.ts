// Pure types/constants for tags. No "use server" — safe to import anywhere.

import {
  COLORES,
  PALETA_CATEGORICA,
  type ColorCategorico,
} from "@/modules/core/ui/paleta";

/*
  Las etiquetas ofrecen los OCHO colores, incluido `acid`, al contrario que los
  hábitos. Música ya tiene etiquetas guardadas con esa clave y quitarla las
  colapsaría con `amber`: dos etiquetas distintas del usuario pasarían a verse
  iguales.

  Antes había aquí una lista propia de siete con sus propios hexadecimales.
  Compartir la paleta es lo que hace que un color signifique lo mismo en una
  etiqueta y en un hábito.
*/
export const TAG_COLORS = COLORES;

export type TagColor = ColorCategorico;

/**
 * Claves que estuvieron guardadas y ya no existen. `violet` y `rose` eran las
 * de la paleta editorial de música; se traducen por tono más cercano.
 */
const LEGACY: Record<string, TagColor> = {
  violet: "lav",
  rose: "pink",
};

export type Tag = {
  id: number;
  name: string;
  color: string;
  trackCount: number;
};

export const isValidTagColor = (c: string): c is TagColor =>
  c in PALETA_CATEGORICA;

/** Traduce lo guardado a una clave válida. No hace falta migrar filas. */
export function resolveTagColor(stored: string): TagColor {
  if (isValidTagColor(stored)) return stored;
  return LEGACY[stored] ?? "amber";
}
