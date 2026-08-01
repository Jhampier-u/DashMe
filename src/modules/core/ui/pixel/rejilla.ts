/*
  Sprites como rejillas de texto.

  Un dibujo se escribe así:

      . . . g . . .
      . . g G g . .
      . g G R G g .
      . . . t . . .

  Un carácter por píxel, cada letra una entrada de la paleta. Este archivo lo
  convierte en rectángulos.

  POR QUÉ ASÍ Y NO SVG A MANO, que es de lo que depende que el jardín en pixel art
  sea posible:

    · Veinticinco sprites en SVG a mano son miles de líneas ilegibles. En rejilla
      son veinticinco bloques que se leen de un vistazo.
    · Se pueden retocar SIN saber SVG: cambiar un pétalo es cambiar una letra.
    · Un error se ve mirando. Un píxel fuera de sitio salta a la vista en el
      texto; en una lista de `<rect x=… y=…>` no lo ve nadie.
*/

/**
 * La paleta de los sprites.
 *
 * NO inventa colores: cada letra apunta a un token que ya existe, así que si
 * algún día cambia la paleta del dashboard, cambian los dibujos.
 *
 * Minúscula es el tono normal y MAYÚSCULA su versión oscura, para poder sombrear
 * sin meter tonos nuevos.
 */
export const PALETA_PIXEL: Record<string, string> = {
  // Verdes: hoja y tallo.
  g: "var(--c-mint)",
  G: "var(--color-line)",
  t: "var(--c-mint)",
  T: "var(--color-line)",
  // Los acentos de la paleta categórica.
  r: "var(--c-pink)",
  R: "var(--c-coral)",
  a: "var(--c-amber)",
  A: "var(--c-peach)",
  l: "var(--c-lav)",
  L: "var(--c-sky)",
  c: "var(--c-sky)",
  C: "var(--c-lav)",
  // Tierra, trazo y papel.
  m: "var(--c-peach)",
  M: "var(--color-line)",
  n: "var(--color-line)",
  N: "var(--color-tinta)",
  p: "var(--color-paper)",
  P: "var(--color-paper-2)",
};

export type Sprite = {
  ancho: number;
  alto: number;
  /** Una fila por línea; cada celda es una letra de la paleta o `null`. */
  celdas: (string | null)[][];
};

export type Rect = {
  x: number;
  y: number;
  ancho: number;
  color: string;
};

const TRANSPARENTE = ".";

/**
 * Lee una rejilla de texto.
 *
 * Los espacios entre celdas son para que se lea y no significan nada: una
 * rejilla con espacios y la misma apretada dan el mismo dibujo. Las líneas
 * vacías del principio y del final tampoco cuentan.
 *
 * Lanza si las filas no miden lo mismo o si aparece una letra que no está en la
 * paleta. Las dos cosas son el error típico de editar a mano, y detectarlas al
 * cargar es mucho mejor que descubrir un sprite torcido mirándolo.
 */
export function parseSprite(texto: string): Sprite {
  const filas = texto
    .split("\n")
    .map((l) => l.replace(/\s+/g, ""))
    .filter((l) => l.length > 0);

  if (filas.length === 0) return { ancho: 0, alto: 0, celdas: [] };

  const ancho = filas[0].length;
  const celdas = filas.map((fila, y) => {
    if (fila.length !== ancho) {
      throw new Error(
        `Sprite torcido: la fila ${y} mide ${fila.length} y el ancho es ${ancho}`,
      );
    }
    return [...fila].map((ch) => {
      if (ch === TRANSPARENTE) return null;
      if (!(ch in PALETA_PIXEL)) {
        throw new Error(`Letra fuera de la paleta: "${ch}"`);
      }
      return ch;
    });
  });

  return { ancho, alto: filas.length, celdas };
}

/**
 * Los rectángulos que hay que pintar.
 *
 * Funde los píxeles seguidos del mismo color en uno solo. Con veinticinco
 * sprites de 16×16 y varias plantas a la vez en pantalla, es la diferencia entre
 * cientos de nodos y unas decenas.
 */
export function rectsDe(sprite: Sprite): Rect[] {
  const rects: Rect[] = [];

  for (let y = 0; y < sprite.alto; y++) {
    const fila = sprite.celdas[y];
    let x = 0;
    while (x < sprite.ancho) {
      const letra = fila[x];
      if (letra === null) {
        x += 1;
        continue;
      }
      let hasta = x + 1;
      while (hasta < sprite.ancho && fila[hasta] === letra) hasta += 1;
      rects.push({
        x,
        y,
        ancho: hasta - x,
        color: PALETA_PIXEL[letra],
      });
      x = hasta;
    }
  }

  return rects;
}
