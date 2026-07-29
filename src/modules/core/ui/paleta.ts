/**
 * La paleta categórica del dashboard: los colores con los que el usuario
 * distingue cosas entre sí —hábitos, etiquetas, y más adelante categorías y
 * prioridades de tarea—.
 *
 * Es una sola porque antes eran dos —una en hábitos y otra en música— y ninguna
 * sabía de la otra. Compartirla es lo que permite que un color signifique lo
 * mismo en toda la aplicación.
 *
 * LOS VALORES ESTÁN MEDIDOS, no elegidos a ojo. Cada uno aguanta la tinta
 * encima con al menos 4,5:1, que es como se usan: cápsulas, filos y rellenos
 * con texto encima. Y los siete que se ofrecen como hábito mantienen entre sí
 * la separación mínima bajo daltonismo que exige `contraste.test.ts`.
 *
 * Añadir un color nuevo NO es libre: hay que volver a medir el conjunto, porque
 * la separación es una propiedad del grupo y no de cada color por su cuenta.
 */
export const PALETA_CATEGORICA = {
  pink: { hex: "#ff9ec7", label: "Rosa" },
  lav: { hex: "#c4b5fd", label: "Lavanda" },
  mint: { hex: "#a7f0c8", label: "Menta" },
  peach: { hex: "#ffd6a5", label: "Melocotón" },
  sky: { hex: "#a5d8ff", label: "Cielo" },
  amber: { hex: "#f4b942", label: "Ámbar" },
  coral: { hex: "#ff9980", label: "Coral" },
  acid: { hex: "#d2ff3a", label: "Lima" },
} as const;

export type ColorCategorico = keyof typeof PALETA_CATEGORICA;

export const COLORES: ColorCategorico[] = Object.keys(
  PALETA_CATEGORICA,
) as ColorCategorico[];

/**
 * Los que se ofrecen como identidad de hábito: todos menos `acid`.
 *
 * `acid` es el amarillo-verde que se retiró de música por decisión estética. Se
 * queda en la paleta —música tiene etiquetas guardadas con esa clave y quitarla
 * las colapsaría con `amber`— pero no se ofrece al crear un hábito.
 *
 * El tipo lo EXCLUYE, no solo la lista: así un hábito con color `acid` no
 * compila, en vez de colarse y descubrirse en pantalla.
 */
export type ColorHabito = Exclude<ColorCategorico, "acid">;

export const COLORES_HABITO: ColorHabito[] = [
  "pink",
  "lav",
  "mint",
  "peach",
  "sky",
  "amber",
  "coral",
];

/** Referencia al token CSS, para estilos en línea. */
export function varColor(key: ColorCategorico): string {
  return `var(--c-${key})`;
}
