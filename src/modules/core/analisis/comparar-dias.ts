/*
  Compara una serie diaria de números partida en dos grupos de días.

  NO SABE DE NINGÚN DOMINIO, y eso es deliberado. La pregunta que responde
  —«¿este número es distinto en estos días que en aquellos?»— no pertenece ni a
  hábitos ni a música: si viviera en uno, ese módulo tendría que importar el otro,
  y hoy no se conocen. Recibe números por día y dos conjuntos de días.

  Las claves de día son números a secas. Aquí no se sabe si son epoch, ordinales
  o índices: solo tienen que ser comparables por igualdad.
*/

/**
 * Días mínimos en CADA grupo para responder.
 *
 * Es la decisión central del bloque que trajo este archivo. Con menos, la mediana
 * depende de un día concreto y el resultado sería inventado — y decir «te faltan
 * 8 días» es información útil, mientras que un porcentaje falso no lo es.
 */
export const MINIMO_POR_GRUPO = 10;

export type Comparacion = {
  /** Si hay bastantes días en los dos grupos para decir algo. */
  suficiente: boolean;
  nA: number;
  nB: number;
  /** Cuántos días faltan en cada grupo. 0 si ya hay bastantes. */
  faltanA: number;
  faltanB: number;
  /** `null` si el grupo está vacío. */
  medianaA: number | null;
  medianaB: number | null;
};

/**
 * La mediana.
 *
 * Se usa esta y no la media porque un solo día raro —ocho horas de música de
 * fondo trabajando— arrastra la media y fabrica una diferencia que no existe.
 */
export function mediana(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const orden = [...xs].sort((a, b) => a - b);
  const medio = Math.floor(orden.length / 2);
  return orden.length % 2 === 1
    ? orden[medio]
    : (orden[medio - 1] + orden[medio]) / 2;
}

export function compararGrupos(
  valorPorDia: Map<number, number>,
  grupoA: Set<number>,
  grupoB: Set<number>,
  minimo: number = MINIMO_POR_GRUPO,
): Comparacion {
  // Un día del grupo sin valor cuenta como CERO y no se descarta: no haber
  // escuchado nada es un dato, y descartarlo subiría la mediana del grupo que
  // menos escucha.
  const deA = [...grupoA].map((d) => valorPorDia.get(d) ?? 0);
  const deB = [...grupoB].map((d) => valorPorDia.get(d) ?? 0);

  const nA = deA.length;
  const nB = deB.length;

  return {
    suficiente: nA >= minimo && nB >= minimo,
    nA,
    nB,
    faltanA: Math.max(0, minimo - nA),
    faltanB: Math.max(0, minimo - nB),
    medianaA: mediana(deA),
    medianaB: mediana(deB),
  };
}
