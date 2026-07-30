import { addDays } from "./day";
import { estaProgramado, type Calendario } from "./calendario";

/**
 * Lo que la racha global necesita saber de un hábito. Coincide a propósito con
 * `HabitSpec` de `metrics.ts`, que es de donde sale: así la racha global cuadra
 * con las gráficas de cumplimiento en vez de llevar su propia cuenta.
 */
export type EspecieDia = {
  id: string;
  /** Su calendario, pausas incluidas. */
  calendario: Calendario;
  /** Primer día en que el hábito cuenta: su creación o su registro más antiguo. */
  since: Date;
};

/** Cuántos días como mucho se miran hacia atrás. */
export const TOPE_DIAS = 400;

/**
 * Días seguidos cumpliendo TODO lo programado.
 *
 * Misma definición que la misión «día completo» que ya existe, para no inventar
 * un segundo criterio de lo mismo: solo cuentan los hábitos cumplidos del todo,
 * así que `hechosPorDia` solo debe traer los no parciales.
 *
 * Es pura y con tope: recorrer hacia atrás sin límite sería un cálculo que crece
 * solo con los años.
 */
export function rachaGlobal(
  specs: EspecieDia[],
  hechosPorDia: Map<number, Set<string>>,
  hoy: Date,
  tope: number = TOPE_DIAS,
): number {
  if (specs.length === 0) return 0;

  let cursor = hoy;
  // Si hoy aún no está completo, se empieza por ayer: queda día para hacerlo, y
  // es la misma cortesía que `computeStreak` tiene con un hábito.
  if (!diaCompleto(specs, hechosPorDia, hoy)) cursor = addDays(hoy, -1);

  let racha = 0;
  for (let i = 0; i < tope; i++) {
    const vigentes = specsVigentes(specs, cursor);
    // Día sin nada programado: no suma y no rompe.
    if (vigentes.length > 0) {
      if (todosHechos(vigentes, hechosPorDia, cursor)) racha += 1;
      else break;
    }
    cursor = addDays(cursor, -1);
  }
  return racha;
}

/** Los hábitos que ese día ya existían y estaban programados. */
function specsVigentes(specs: EspecieDia[], dia: Date): EspecieDia[] {
  return specs.filter(
    (s) =>
      s.since.getTime() <= dia.getTime() && estaProgramado(s.calendario, dia),
  );
}

function todosHechos(
  vigentes: EspecieDia[],
  hechosPorDia: Map<number, Set<string>>,
  dia: Date,
): boolean {
  const hechos = hechosPorDia.get(dia.getTime());
  if (!hechos) return false;
  return vigentes.every((s) => hechos.has(s.id));
}

/** ¿Ese día estaba todo hecho? Un día sin nada programado NO cuenta como completo. */
function diaCompleto(
  specs: EspecieDia[],
  hechosPorDia: Map<number, Set<string>>,
  dia: Date,
): boolean {
  const vigentes = specsVigentes(specs, dia);
  if (vigentes.length === 0) return false;
  return todosHechos(vigentes, hechosPorDia, dia);
}
