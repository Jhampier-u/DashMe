/**
 * Medición de la paleta: contraste WCAG y separación de color bajo daltonismo.
 *
 * Este módulo no pinta nada. Existe para que `contraste.test.ts` pueda afirmar
 * que la paleta cumple sus propias reglas, y para que el build falle el día que
 * alguien "afine a ojo" un token y lo rompa.
 *
 * ---------------------------------------------------------------------------
 * FUENTES DE LAS CONSTANTES
 *
 * Ninguna cifra de este archivo está puesta de memoria ni aproximada. Un test
 * de accesibilidad con matrices inventadas pasa igual pero no mide nada, así
 * que cada bloque de números lleva su procedencia:
 *
 * [1] Luminancia relativa y ratio de contraste — WCAG 2.x, "relative
 *     luminance" y "contrast ratio":
 *     https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 *     L = 0.2126 R + 0.7152 G + 0.0722 B sobre canales linealizados con
 *     `c <= 0.03928 ? c/12.92 : ((c+0.055)/1.055)^2.4`.
 *     (WCAG cita 0.03928; el umbral de IEC 61966-2-1 es 0.04045. Se respeta el
 *     de WCAG en `luminancia` porque es el que define la norma que medimos, y
 *     el de sRGB en la ruta colorimétrica de más abajo. La diferencia entre
 *     ambos afecta solo a valores por debajo de 10/255.)
 *
 * [2] sRGB -> CIE XYZ (D65) — IEC 61966-2-1, tal y como la reproduce
 *     https://en.wikipedia.org/wiki/SRGB ("these 4-digit coefficients should
 *     be considered exact").
 *
 * [3] CIE XYZ -> CIELAB y blanco de referencia D65 (Xn 95.0489, Yn 100,
 *     Zn 108.8840), con delta = 6/29 —
 *     https://en.wikipedia.org/wiki/CIELAB_color_space
 *     ΔE CIE76 es la distancia euclídea en L*a*b*.
 *
 * [4] Simulación de dicromacia — Viénot, Brettel & Mollon (1999), "Digital
 *     video colourmaps for checking the legibility of displays by dichromats",
 *     Color Research & Application 24(4):243-252, en la formulación y con las
 *     matrices que publica DaltonLens:
 *     https://daltonlens.org/understanding-cvd-simulation/
 *     - `LMS_DESDE_RGB_LINEAL`: modelo LMS Smith & Pokorny 1975 sobre
 *       primarios sRGB (el artículo lo imprime multiplicado por 100).
 *     - La proyección NO se copia de ningún sitio: se deriva aquí del propio
 *       método. Viénot proyecta sobre el único plano que pasa por el origen,
 *       el azul (0,0,1) y el amarillo (1,1,0) en RGB lineal. Con eso la matriz
 *       queda determinada por geometría y no hay coeficientes que memorizar.
 *     - `verificarViénot()` comprueba que esa derivación reproduce la matriz de
 *       protanopía que DaltonLens publica ya calculada
 *       (https://daltonlens.org/cvd-simulation-svg-filters/):
 *           0.10889  0.89111 -0.00000
 *           0.10889  0.89111  0.00000
 *           0.00447 -0.00447  1.00000
 *       Si la derivación se desviara, el test lo cantaría.
 * ---------------------------------------------------------------------------
 */

export type Rgb = [number, number, number];
export type Vision = "normal" | "deutan" | "protan";

type Mat3 = readonly [Rgb, Rgb, Rgb];

// ---------------------------------------------------------------------------
// Álgebra mínima
// ---------------------------------------------------------------------------

function aplicar(m: Mat3, v: Rgb): Rgb {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}

function multiplicar(a: Mat3, b: Mat3): Mat3 {
  const r: number[][] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      r[i][j] = a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j];
    }
  }
  return [r[0] as Rgb, r[1] as Rgb, r[2] as Rgb];
}

/** Inversa por cofactores. Se calcula, no se transcribe. */
function invertir(m: Mat3): Mat3 {
  const [[a, b, c], [d, e, f], [g, h, i]] = m;
  const det =
    a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  if (Math.abs(det) < 1e-12) {
    throw new Error("matriz singular: no se puede invertir");
  }
  return [
    [(e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det],
    [(f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det],
    [(d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det],
  ];
}

function producto_vectorial(u: Rgb, v: Rgb): Rgb {
  return [
    u[1] * v[2] - u[2] * v[1],
    u[2] * v[0] - u[0] * v[2],
    u[0] * v[1] - u[1] * v[0],
  ];
}

// ---------------------------------------------------------------------------
// Hex y luminancia — [1]
// ---------------------------------------------------------------------------

export function hexARgb(hex: string): Rgb {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  if (!/^[0-9a-fA-F]{6}$/.test(h)) {
    throw new Error(`hex inválido: ${hex}`);
  }
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbAHex(rgb: Rgb): string {
  return (
    "#" +
    rgb
      .map((c) => {
        const v = Math.max(0, Math.min(255, Math.round(c)));
        return v.toString(16).padStart(2, "0");
      })
      .join("")
  );
}

/** Luminancia relativa WCAG. Umbral 0.03928 tal y como lo define la norma. [1] */
export function luminancia(rgb: Rgb): number {
  const [r, g, b] = rgb.map((canal) => {
    const c = canal / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Ratio de contraste WCAG: (Lmax + 0.05) / (Lmin + 0.05). [1] */
export function contraste(a: string, b: string): number {
  const la = luminancia(hexARgb(a));
  const lb = luminancia(hexARgb(b));
  const max = Math.max(la, lb);
  const min = Math.min(la, lb);
  return (max + 0.05) / (min + 0.05);
}

// ---------------------------------------------------------------------------
// sRGB <-> XYZ <-> Lab — [2] y [3]
// ---------------------------------------------------------------------------

/**
 * RGB lineal -> CIE XYZ (D65), primarios sRGB de IEC 61966-2-1. La norma
 * publica la forma redondeada a 4 dígitos (0.4124, 0.3576, ...); aquí va la
 * derivada de los primarios con más cifras, que es la que usan las
 * implementaciones de referencia. [2]
 */
const XYZ_DESDE_RGB_LINEAL: Mat3 = [
  [0.412456, 0.3575761, 0.1804375],
  [0.212672, 0.7151522, 0.072175],
  [0.019333, 0.119192, 0.9503041],
];

/** Blanco D65 de CIELAB, normalizado a Yn = 1. [3] */
const BLANCO_D65: Rgb = [0.950489, 1.0, 1.088840];

/** Decodificación gamma de sRGB. Umbral 0.04045 de IEC 61966-2-1. [1] */
function linealizar(canal: number): number {
  const c = canal / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function codificarGamma(c: number): number {
  const v = Math.max(0, Math.min(1, c));
  const s = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
  return s * 255;
}

function rgbALineal(rgb: Rgb): Rgb {
  return [linealizar(rgb[0]), linealizar(rgb[1]), linealizar(rgb[2])];
}

function linealARgb(lin: Rgb): Rgb {
  return [codificarGamma(lin[0]), codificarGamma(lin[1]), codificarGamma(lin[2])];
}

const DELTA = 6 / 29;

function f_lab(t: number): number {
  return t > DELTA ** 3 ? Math.cbrt(t) : t / (3 * DELTA ** 2) + 4 / 29;
}

/** CIE XYZ -> CIELAB con blanco D65. [3] */
function xyzALab(xyz: Rgb): Rgb {
  const fx = f_lab(xyz[0] / BLANCO_D65[0]);
  const fy = f_lab(xyz[1] / BLANCO_D65[1]);
  const fz = f_lab(xyz[2] / BLANCO_D65[2]);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function hexALab(hex: string): Rgb {
  return xyzALab(aplicar(XYZ_DESDE_RGB_LINEAL, rgbALineal(hexARgb(hex))));
}

/** ΔE CIE76: distancia euclídea en L*a*b*. [3] */
export function deltaE(a: string, b: string): number {
  const la = hexALab(a);
  const lb = hexALab(b);
  return Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2]);
}

// ---------------------------------------------------------------------------
// Simulación de dicromacia — Viénot, Brettel & Mollon 1999 — [4]
// ---------------------------------------------------------------------------

/**
 * CIE XYZ -> LMS, fundamentales de Smith & Pokorny 1975, que es el modelo que
 * usa Viénot 1999 y el que DaltonLens recomienda para simular dicromacia. [4]
 */
const LMS_DESDE_XYZ: Mat3 = [
  [0.15514, 0.54312, -0.03286],
  [-0.15514, 0.45684, 0.03286],
  [0.0, 0.0, 0.01608],
];

/**
 * RGB lineal -> LMS. Se compone, no se transcribe.
 *
 * Nota sobre qué XYZ se usa aquí: Smith & Pokorny se definieron sobre el
 * observador con la corrección de Judd-Vos, y DaltonLens ofrece las dos
 * variantes. Componer sobre Judd-Vos da la matriz de protanopía 0.11238 /
 * 0.88762 / 0.00401 y componer sobre el CIE 1931 de sRGB da 0.10889 / 0.89111
 * / 0.00447. Las dos circulan publicadas como "Viénot 1999". Se usa la segunda
 * porque es la que DaltonLens publica ya resuelta y por tanto la única contra
 * la que `verificarViénot()` puede contrastar de verdad. A los umbrales de ΔE
 * que mide este archivo la diferencia entre ambas es irrelevante. [4]
 */
const LMS_DESDE_RGB_LINEAL: Mat3 = multiplicar(
  LMS_DESDE_XYZ,
  XYZ_DESDE_RGB_LINEAL,
);

const RGB_LINEAL_DESDE_LMS = invertir(LMS_DESDE_RGB_LINEAL);

/**
 * Viénot 1999 proyecta sobre el plano que contiene el origen, el azul y el
 * amarillo. La normal de ese plano fija la matriz: no hay constantes sueltas.
 */
const LMS_AZUL = aplicar(LMS_DESDE_RGB_LINEAL, [0, 0, 1]);
const LMS_AMARILLO = aplicar(LMS_DESDE_RGB_LINEAL, [1, 1, 0]);
const NORMAL = producto_vectorial(LMS_AZUL, LMS_AMARILLO);

/**
 * El dicrómata pierde un eje: se reconstruye desde los otros dos imponiendo
 * que el color caiga en el plano (NORMAL · LMS = 0).
 *   protan -> se recalcula L;  deutan -> se recalcula M.
 */
function proyeccion(eje: 0 | 1): Mat3 {
  const [nL, nM, nS] = NORMAL;
  const n: Rgb = [nL, nM, nS];
  const fila: Rgb = [0, 0, 0];
  for (let j = 0; j < 3; j++) {
    fila[j] = j === eje ? 0 : -n[j] / n[eje];
  }
  const m: Rgb[] = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  m[eje] = fila;
  return [m[0], m[1], m[2]];
}

const MATRICES_CVD: Record<Exclude<Vision, "normal">, Mat3> = {
  protan: multiplicar(
    RGB_LINEAL_DESDE_LMS,
    multiplicar(proyeccion(0), LMS_DESDE_RGB_LINEAL),
  ),
  deutan: multiplicar(
    RGB_LINEAL_DESDE_LMS,
    multiplicar(proyeccion(1), LMS_DESDE_RGB_LINEAL),
  ),
};

/**
 * Comprueba que la derivación geométrica reproduce la matriz de protanopía que
 * DaltonLens publica ya resuelta. Es el candado que impide que este archivo
 * mida cualquier cosa: si el pipeline se rompe, esto revienta al importar. [4]
 */
const PROTAN_PUBLICADA: Mat3 = [
  [0.10889, 0.89111, 0.0],
  [0.10889, 0.89111, 0.0],
  [0.00447, -0.00447, 1.0],
];

function verificarViénot(): void {
  const derivada = MATRICES_CVD.protan;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (Math.abs(derivada[i][j] - PROTAN_PUBLICADA[i][j]) > 5e-5) {
        throw new Error(
          `la simulación de Viénot no reproduce la matriz publicada en [${i}][${j}]: ` +
            `${derivada[i][j]} vs ${PROTAN_PUBLICADA[i][j]}`,
        );
      }
    }
  }

  /*
    La matriz publicada solo cubre protanopía, así que la de deuteranopía se
    comprueba por la propiedad que la define: el plano de proyección contiene
    el azul y el amarillo, luego ambos tienen que quedarse quietos, y el blanco
    (que es su suma) con ellos. Si el eje que se recalcula fuera el equivocado,
    esto no se cumpliría.
  */
  const fijos: Rgb[] = [
    [0, 0, 1],
    [1, 1, 0],
    [1, 1, 1],
  ];
  for (const tipo of ["protan", "deutan"] as const) {
    for (const v of fijos) {
      const out = aplicar(MATRICES_CVD[tipo], v);
      for (let k = 0; k < 3; k++) {
        if (Math.abs(out[k] - v[k]) > 1e-6) {
          throw new Error(
            `la simulación ${tipo} mueve un color que debería dejar fijo: ` +
              `[${v}] -> [${out}]`,
          );
        }
      }
    }
  }
}

verificarViénot();

/** Devuelve el hex tal y como lo vería `tipo`. [4] */
export function simular(hex: string, tipo: Vision): string {
  if (tipo === "normal") return hex.toLowerCase();
  const lineal = rgbALineal(hexARgb(hex));
  return rgbAHex(linealARgb(aplicar(MATRICES_CVD[tipo], lineal)));
}

/** ΔE del par más cercano del conjunto, una vez simulada la visión. */
export function separacionMinima(
  colores: Record<string, string>,
  tipo: Vision,
): number {
  const hexes = Object.values(colores).map((h) => simular(h, tipo));
  let min = Infinity;
  for (let i = 0; i < hexes.length; i++) {
    for (let j = i + 1; j < hexes.length; j++) {
      min = Math.min(min, deltaE(hexes[i], hexes[j]));
    }
  }
  return min === Infinity ? 0 : min;
}

// ---------------------------------------------------------------------------
// La paleta
// ---------------------------------------------------------------------------

/*
  Ratios de contraste medidos (WCAG, los que afirma `contraste.test.ts`):

    ink  #4a3a52 sobre paper  #fff5fb ..... 9.76:1   (AA y AAA de texto normal)
    ink  #4a3a52 sobre paper2 #ffeaf6 ..... 9.09:1   (idem)
    ink2 #8a738f sobre paper  #fff5fb ..... 4.00:1   (AA de texto grande; NO
                                                      vale para cuerpo de texto)
    line #4a3a52 sobre paper  #fff5fb ..... 9.76:1   (line == ink)

  Cada pastel como fondo, con la tinta encima:

    pink   #ff9ec7 ..... 5.43:1      peach  #ffd6a5 ..... 7.64:1
    lav    #c4b5fd ..... 5.64:1      sky    #a5d8ff ..... 6.87:1
    mint   #a7f0c8 ..... 7.90:1      yellow #ffe6a7 ..... 8.49:1

  Los seis pasan 4.5:1 tal cual: no hubo que oscurecer ninguno.
*/
export const PALETA = {
  paper: "#fff5fb",
  paper2: "#ffeaf6",
  ink: "#4a3a52",
  ink2: "#8a738f",
  line: "#4a3a52",
  acentos: {
    pink: "#ff9ec7",
    lav: "#c4b5fd",
    mint: "#a7f0c8",
    peach: "#ffd6a5",
    sky: "#a5d8ff",
    yellow: "#ffe6a7",
  },
} as const;

/*
  Los tres que identifican hábitos. Son exactamente tres por la misma razón que
  lo eran en el sistema anterior: con la lista completa de pares, ningún
  conjunto de cuatro mantiene la separación bajo daltonismo.

  EL ROSA SALIÓ DE AQUÍ. Pasó a ser el acento principal de todo el dashboard, y
  un color no puede identificar un hábito y significar «acción primaria» a la
  vez: en la pantalla de hábitos convivirían. Su hueco lo ocupa `sky`.

  Se midieron las veinte ternas posibles antes de elegir. ΔE CIE76 tras simular
  cada visión:

                   normal   deutan   protan
    lav  ~ mint     69.4     47.5     56.6
    lav  ~ sky      29.6     10.1     17.2
    mint ~ sky      43.7     33.4     34.1
    ------------------------------------------
    peor par        29.6     10.1     17.2
    umbral exigido  20        9        9

  El par que manda es lav~sky en deuteranopía, y 10,1 es el número más justo de
  todo el sistema: pasa, pero con poco margen. La alternativa era lav+mint+peach
  (22,0 en deutan), descartada porque peach es el destructivo y chocaría con él.
*/
export const ACENTOS_HABITO = {
  lav: PALETA.acentos.lav,
  mint: PALETA.acentos.mint,
  sky: PALETA.acentos.sky,
} as const;
