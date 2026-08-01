/*
  El tiempo del jardín: qué nubes salen según cómo ha ido tu semana.

  Es pura y recibe dos números ya contados, no la base. Quien los cuenta es
  `getDiasCumplidos`, que ya existe, ya está probado y —esto es lo importante— ya
  DEJA FUERA LOS DÍAS EN PAUSA. Una semana de vacaciones llega aquí como cero y
  cero, no como una semana de fallos.
*/

export type Clima = "despejado" | "nublado" | "lluvia" | "sin-dato";

/**
 * Cuántas nubes se pintan en cada estado.
 *
 * Es la SEGUNDA SEÑAL: cantidad además de forma, para que el estado no dependa
 * de distinguir un emoji pequeño. Los cuatro valores son distintos a propósito.
 */
export const NUBES: Record<Clima, number> = {
  despejado: 0,
  nublado: 2,
  lluvia: 4,
  "sin-dato": 1,
};

export const ETIQUETA: Record<Clima, string> = {
  despejado: "Despejado",
  nublado: "Algo nublado",
  lluvia: "Lluvia",
  "sin-dato": "Aún sin datos",
};

export type Tiempo = {
  estado: Clima;
  nubes: number;
  cumplidos: number;
  /** Días que contaban: ni en pausa, ni sin nada programado. */
  evaluables: number;
};

/*
  Los umbrales caen del lado de NO CASTIGAR.

  Con siete días, 80% son 6 de 7 y 40% son 3 de 7: un fallo a la semana sigue
  siendo despejado, y hacen falta cuatro para que llueva. Un jardín que se nubla
  al primer tropiezo enseña a evitar el jardín.
*/
const DESPEJADO = 0.8;
const NUBLADO = 0.4;

export function climaDe(cumplidos: number, fallados: number): Tiempo {
  const c = Math.max(0, cumplidos);
  const f = Math.max(0, fallados);
  const evaluables = c + f;

  // Sin días que evaluar no se inventa un tiempo. Misma regla que en el panel de
  // música: antes callar que inventar.
  if (evaluables === 0) {
    return { estado: "sin-dato", nubes: NUBES["sin-dato"], cumplidos: 0, evaluables: 0 };
  }

  const tasa = c / evaluables;
  const estado: Clima =
    tasa >= DESPEJADO ? "despejado" : tasa >= NUBLADO ? "nublado" : "lluvia";

  return { estado, nubes: NUBES[estado], cumplidos: c, evaluables };
}
