import { normalizeDayKey } from "./day";

/*
  La regla de qué día cuenta para la racha, en UN solo sitio.

  Existe por una razón concreta y no por gusto: cinco lugares del módulo
  construían ese conjunto de días por su cuenta —`habits.ts`, `home.ts`,
  `stats.ts` y dos veces `mutations.ts`—. Con la cantidad, cinco copias de la
  regla serían cinco oportunidades de que una se quede atrás, y el síntoma sería
  la misma racha saliendo distinta en la portada y en el detalle, sin dar error.
*/

/** Lo mínimo que hace falta saber de un registro para decidir si cuenta. */
export type LogParaRacha = {
  date: Date;
  partial: boolean;
  /** Lo apuntado ese día. Nulo en todo lo registrado antes de este bloque. */
  count: number | null;
};

/**
 * ¿Ese día está completo?
 *
 * Sin objetivo lo manda el botón, como siempre. CON objetivo lo manda la
 * cantidad y el botón no puede saltárselo: si no, apuntar 3 de 8 vasos y pulsar
 * «hecho» daría un día completo con tres vasos.
 *
 * Con objetivo pero sin cantidad apuntada —los registros de antes de este
 * bloque— solo queda el botón, que es la única información que existe.
 */
export function esCompleto(
  targetCount: number | null,
  count: number | null,
  partial: boolean,
): boolean {
  if (targetCount === null) return !partial;
  if (count === null) return !partial;
  return count >= targetCount;
}

/**
 * Los días que cuentan para la racha, ya normalizados al día.
 *
 * SIN objetivo cuenta todo registro, incluidos los de modo mínimo: es
 * exactamente el comportamiento de hoy, y de eso depende que ningún hábito
 * existente cambie de racha.
 */
export function diasQueCuentan(
  logs: LogParaRacha[],
  targetCount: number | null,
): Set<number> {
  const set = new Set<number>();
  for (const l of logs) {
    if (targetCount === null || esCompleto(targetCount, l.count, l.partial)) {
      set.add(normalizeDayKey(l.date).getTime());
    }
  }
  return set;
}

/** Un registro con su hábito, para agrupar por día varios hábitos a la vez. */
export type LogConHabito = LogParaRacha & { habitId: string };

/**
 * Qué hábitos completaron cada día, con LA MISMA regla que las rachas.
 *
 * Existe porque tres sitios —la racha global de la portada, el clima del jardín
 * y la misión del día perfecto— construían este mapa a mano filtrando solo por
 * `partial`, sin mirar el objetivo. El resultado medido: con un objetivo de 8 y
 * 2 apuntados, la portada felicitaba por «tres días cumpliendo todo» mientras la
 * racha de ese mismo hábito era cero.
 *
 * Es exactamente el fallo contra el que avisa el comentario de arriba: cinco
 * copias de la regla, y una que se queda atrás sin dar error.
 */
export function cumplidosPorDia(
  logs: LogConHabito[],
  objetivoPorHabito: Map<string, number | null>,
): Map<number, Set<string>> {
  const porDia = new Map<number, Set<string>>();
  for (const l of logs) {
    if (
      !esCompleto(objetivoPorHabito.get(l.habitId) ?? null, l.count, l.partial)
    ) {
      continue;
    }
    const t = normalizeDayKey(l.date).getTime();
    const set = porDia.get(t);
    if (set) set.add(l.habitId);
    else porDia.set(t, new Set([l.habitId]));
  }
  return porDia;
}
