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
