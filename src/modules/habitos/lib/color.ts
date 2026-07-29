import {
  COLORES_HABITO,
  PALETA_CATEGORICA,
  varColor,
  type ColorHabito,
} from "@/modules/core/ui/paleta";

/**
 * Los colores de identidad de un hábito: los siete de la paleta categórica,
 * todos menos `acid`.
 *
 * Eran tres, y sus claves —`aqua`, `violet`, `orange`— ya no describían su
 * color desde el rediseño: valían menta, lavanda y cielo. Añadir cuatro claves
 * correctas al lado habría dejado la mitad del conjunto mintiendo, así que se
 * renombran todas y las viejas pasan al mapa `LEGACY` de abajo.
 *
 * La separación de los siete bajo daltonismo la afirma `contraste.test.ts`.
 */
export type HabitColor = ColorHabito;

export const HABIT_COLORS: { key: HabitColor; label: string }[] =
  COLORES_HABITO.map((key) => ({ key, label: PALETA_CATEGORICA[key].label }));

/**
 * El defecto sigue siendo menta, que es lo que valía `aqua`.
 *
 * El esquema de la base declara `aqua` como `@default` de la columna y no se
 * toca: `resolveHabitColor` lo traduce a menta, así que una fila insertada por
 * fuera de la aplicación acaba en el mismo sitio.
 */
export const DEFAULT_HABIT_COLOR: HabitColor = "mint";

/**
 * Claves que estuvieron guardadas en la base y ya no existen, traducidas por
 * tono más cercano.
 *
 * Las tres primeras son las del sistema oscuro, que se renombraron al ampliar
 * la paleta. Las de abajo son de la era pixel original; `moss` era el `@default`
 * del esquema y nunca existió como token, así que ninguna fila que lo tenga
 * guardado mostró jamás un color.
 *
 * No hace falta migrar filas: se resuelve en lectura.
 */
const LEGACY: Record<string, HabitColor> = {
  aqua: "mint",
  violet: "lav",
  orange: "pink",
  moss: "mint",
  lavender: "lav",
};

/** Traduce lo que hay guardado en la base de datos a una clave válida. */
export function resolveHabitColor(stored: string): HabitColor {
  if (stored in PALETA_CATEGORICA && stored !== "acid") {
    return stored as HabitColor;
  }
  return LEGACY[stored] ?? DEFAULT_HABIT_COLOR;
}

/** Referencia al token CSS del color, para usar en estilos inline. */
export function habitColorVar(key: HabitColor): string {
  return varColor(key);
}
