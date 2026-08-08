/*
  Cuánto sitio necesita el jardín para que las plantas quepan EN EL SUELO.

  Nació de un fallo que ninguna comprobación del DOM veía y que solo se notaba
  mirando: las plantas salían flotando en el cielo. Eran dos cosas sumadas —la
  rejilla empezaba por encima del horizonte, y además era más corta que su
  contenido, así que lo que sobraba desbordaba HACIA ARRIBA—.

  Aquí está la aritmética, separada de la escena, para poder afirmar con un test
  lo que antes hacía falta un ojo humano para ver.
*/

/** Dónde parte el suelo, en porcentaje de la altura de la escena. */
export const HORIZONTE = 62;

/**
 * Lo que ocupa una fila de plantas, en píxeles.
 *
 * Es el caso PEOR y no el medio: una planta floreciente mide 72 px, más su
 * parcela y su cartel. Calcular con la media dejaría las florecientes fuera, y
 * quedarse corto aquí es exactamente lo que las mandaba al cielo.
 *
 * El número está MEDIDO, no estimado: una fila de semillas ocupa 102 px en
 * pantalla, de los que 30 son el dibujo. Los otros 72 —parcela, márgenes y
 * cartel— no cambian con la etapa, así que la fila más alta posible son esos 72
 * más los 72 de una floreciente: 144. Los 4 que sobran son holgura.
 */
export const ALTO_FILA = 148;

/** Separación entre filas, la misma que usa la rejilla. */
const HUECO = 12;

/** Aire por debajo de la última fila. */
const MARGEN_INFERIOR = 20;

/** La escena nunca es más baja que esto, aunque haya una sola planta. */
export const ALTO_MINIMO = 480;

export type Disposicion = {
  columnas: number;
  filas: number;
  /** Altura mínima de la escena para que quepan todas las filas bajo el horizonte. */
  minAlto: number;
};

/**
 * Cómo se reparte el jardín para `n` plantas.
 *
 * Las columnas salen del número de plantas y no de su raíz cuadrada. Con la
 * raíz, tres plantas daban dos columnas y por tanto DOS FILAS, que no cabían.
 * Tres plantas caben de sobra en una fila.
 */
export function disposicionDelJardin(n: number): Disposicion {
  const plantas = Math.max(0, Math.floor(n));
  const columnas = Math.min(4, Math.max(2, plantas));
  const filas = plantas === 0 ? 0 : Math.ceil(plantas / columnas);

  const necesario =
    filas === 0 ? 0 : filas * ALTO_FILA + (filas - 1) * HUECO + MARGEN_INFERIOR;

  /*
    El suelo es la franja que va del horizonte al fondo, o sea `1 - HORIZONTE`
    de la altura. Si las filas no caben ahí, la escena crece hasta que quepan.

    Crece la ESCENA y no baja el horizonte, aunque bajarlo daría un jardín más
    compacto: las decoraciones de la tienda declaran su sitio en porcentajes
    contados sobre este horizonte, y moverlo las dejaría flotando a ellas. Se
    cambia una cosa cada vez.
  */
  const fraccionDeSuelo = (100 - HORIZONTE) / 100;
  return {
    columnas,
    filas,
    minAlto: Math.max(ALTO_MINIMO, Math.ceil(necesario / fraccionDeSuelo)),
  };
}

/**
 * Dónde acaba la última fila, contando desde arriba de la escena.
 *
 * La rejilla arranca EN el horizonte, así que ninguna planta sube por encima
 * por construcción. Lo que sí puede pasar —y pasaba— es que las filas no quepan
 * y desborden. Esto dice hasta dónde llegan.
 */
export function pieDeLasPlantas(n: number, altoDeLaEscena: number): number {
  const { filas } = disposicionDelJardin(n);
  if (filas === 0) return 0;
  const horizonte = (altoDeLaEscena * HORIZONTE) / 100;
  return horizonte + filas * ALTO_FILA + (filas - 1) * HUECO;
}

/**
 * Si las plantas caben enteras entre el horizonte y el fondo.
 *
 * ES LA GARANTÍA DE ESTE MÓDULO, y la que faltaba. Cuando no se cumplía, el
 * sobrante no se recortaba: `alignContent: end` lo empuja hacia ARRIBA, y las
 * plantas aparecían plantadas en el cielo.
 */
export function cabenBajoElHorizonte(
  n: number,
  altoDeLaEscena: number,
): boolean {
  return pieDeLasPlantas(n, altoDeLaEscena) + MARGEN_INFERIOR <= altoDeLaEscena;
}
