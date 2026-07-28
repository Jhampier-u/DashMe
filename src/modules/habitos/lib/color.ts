/**
 * Los colores de identidad de un hábito.
 *
 * Son tres y no cinco por una razón medible: validados como paleta categórica
 * sobre la superficie oscura y con la lista de todos los pares —que es el caso
 * real, porque todas las muestras se ven juntas en el selector y todos los
 * hábitos se ven juntos en la lista— ningún conjunto de cuatro pasa la
 * separación bajo daltonismo ni el suelo de visión normal. Tres es el máximo.
 *
 * Quedan fuera a propósito:
 *  - el azul #3987e5, que es --m-series, el color de las gráficas
 *  - verde, amarillo y rojo, que son --m-good, --m-warn y --m-crit
 *
 * Regla que acompaña al naranja: no poner un relleno de --m-crit a plena
 * intensidad junto a un acento de hábito. El filo crítico de la fila va al 45%
 * de opacidad, que compuesto queda a ΔE 22.9 del naranja, y ahí no hay
 * confusión posible.
 */
export type HabitColor = "aqua" | "violet" | "orange";

/**
 * Las claves son las de la base de datos y no se tocan; las etiquetas son lo
 * que lee quien elige un color, así que siguen al valor. Con el sistema pixel
 * los tres pasaron a menta, lavanda y rosa —ver `tokens.css`—, y una muestra
 * rosa rotulada «Naranja» habría sido peor que el desajuste de nombres que ya
 * arrastran las claves por dentro.
 */
export const HABIT_COLORS: { key: HabitColor; label: string }[] = [
  { key: "aqua", label: "Menta" },
  { key: "violet", label: "Lavanda" },
  { key: "orange", label: "Rosa" },
];

export const DEFAULT_HABIT_COLOR: HabitColor = "aqua";

/**
 * Claves de la era pixel, traducidas por tono más cercano. `moss` era el
 * `@default` del esquema y nunca existió como token, así que ninguna fila que
 * lo tenga guardado mostró jamás un color.
 */
const LEGACY: Record<string, HabitColor> = {
  mint: "aqua",
  moss: "aqua",
  sky: "violet",
  lavender: "violet",
  peach: "orange",
  pink: "orange",
};

/**
 * Traduce lo que hay guardado en la base de datos a una clave válida. No hace
 * falta migrar filas: se resuelve en lectura.
 */
export function resolveHabitColor(stored: string): HabitColor {
  if (stored === "aqua" || stored === "violet" || stored === "orange") {
    return stored;
  }
  return LEGACY[stored] ?? DEFAULT_HABIT_COLOR;
}

/** Referencia al token CSS del color, para usar en estilos inline. */
export function habitColorVar(key: HabitColor): string {
  return `var(--h-${key})`;
}
