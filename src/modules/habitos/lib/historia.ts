import { addDays } from "./day";
import { cal, estaProgramado, type Calendario, type Rango } from "./calendario";
import { computeStreak } from "./streak";
import { isPlantWilted, stageFor, type PlantSpecies } from "./garden";

/*
  El jardín de cualquier día pasado.

  No hay nada guardado que diga cómo se veía tu jardín el 12 de julio, y no hace
  falta: los registros dicen qué cumpliste y cuándo, las pausas qué días no
  contaban y el horario qué días tocaban. La memoria no se graba, SE DEDUCE.

  Contrapartida honesta: esto refleja los registros de HOY, no una foto de aquel
  día. Si borras el registro del 12 de julio, el 12 de julio cambia también aquí.
  Es lo correcto —los registros son la verdad— pero no es un historial de
  auditoría y no debe venderse como tal.

  Todo esto es puro. Recibe los datos y devuelve plantas; no toca la base ni sabe
  qué día es hoy salvo porque se lo dicen.
*/

/** Lo que hace falta saber de un hábito para reconstruirlo. */
export type HabitoHistorico = {
  id: string;
  name: string;
  color: string;
  plantSpecies: PlantSpecies;
  isAnchor: boolean;
  schedule: string;
  /** Cuándo se creó, en clave de día. Antes de esto la planta no existía. */
  creado: Date;
  pausas: Rango[];
  /** `getTime()` de cada clave de día cumplida, con la regla del jardín vivo. */
  cumplidos: number[];
  /**
   * `getTime()` de cada día con registro NO parcial.
   *
   * Es OTRA definición, la que usa `getDiasCumplidos` para el clima, y va
   * separada porque de verdad son distintas: `cumplidos` respeta el objetivo
   * numérico y esta no. Unificarlas sería otro bloque; mezclarlas haría que el
   * clima de la memoria no coincidiera con el del presente.
   */
  plenos: number[];
};

/** Una planta tal y como se veía ese día. */
export type PlantaEn = {
  id: string;
  name: string;
  color: string;
  plantSpecies: PlantSpecies;
  isAnchor: boolean;
  streak: number;
  stage: 0 | 1 | 2 | 3 | 4;
  marchita: boolean;
  /** Si a esa altura ya se había cumplido alguna vez. Separa marchita de semilla. */
  algunaVezCumplido: boolean;
  cumplidoEseDia: boolean;
  programadoEseDia: boolean;
};

/**
 * La racha de un hábito al **cierre** de un día pasado.
 *
 * `computeStreak` tiene una gracia deliberada: si hoy toca y aún no lo has
 * hecho, la racha no se rompe todavía, porque tienes hasta medianoche. Esa
 * gracia es correcta para hoy y es MENTIRA para ayer: el 12 de julio ya se
 * acabó, y pintar la planta viva un día que fallaste sería contar una versión
 * favorable de tu pasado.
 *
 * Así que para un día pasado se mira desde el día siguiente: desde ahí, el día
 * en cuestión ya es «ayer» y `computeStreak` lo juzga sin gracia. Para hoy se
 * llama tal cual y la gracia se conserva.
 */
export function rachaEn(
  calendario: Calendario,
  cumplidos: Set<number>,
  dia: Date,
  hoy: Date,
): number {
  if (dia.getTime() >= hoy.getTime()) {
    return computeStreak(calendario, cumplidos, dia);
  }
  // Un detalle que se puede leer mal: `computeStreak` empieza por el día que se
  // le da y solo retrocede. Pasarle el día siguiente NO cuenta ese día siguiente
  // como cumplido —no está en el conjunto, porque aún no había pasado— y lo que
  // hace es exactamente lo que se busca: empezar a contar en `dia` sin gracia.
  return computeStreak(calendario, cumplidos, addDays(dia, 1));
}

/**
 * El jardín entero en un día.
 *
 * Los hábitos creados después de ese día se caen de la lista. Un hábito que
 * empezaste ayer no estaba en tu jardín en junio, y pintarlo ahí inventaría una
 * racha que nunca tuviste.
 */
export function jardinEn(
  habitos: HabitoHistorico[],
  dia: Date,
  hoy: Date,
): PlantaEn[] {
  const plantas: PlantaEn[] = [];
  for (const h of habitos) {
    if (h.creado.getTime() > dia.getTime()) continue;

    const calendario = cal(h.schedule, h.pausas);
    // Solo lo cumplido HASTA ese día. Lo de después todavía no había pasado, y
    // colarlo haría que el pasado supiera el futuro.
    const hasta = new Set(h.cumplidos.filter((t) => t <= dia.getTime()));
    const cumplidoEseDia = hasta.has(dia.getTime());
    const streak = rachaEn(calendario, hasta, dia, hoy);

    plantas.push({
      id: h.id,
      name: h.name,
      color: h.color,
      plantSpecies: h.plantSpecies,
      isAnchor: h.isAnchor,
      streak,
      stage: stageFor(streak),
      // `hasEverBeenDone` es, ese día, «hubo alguna vez un cumplido»: el tamaño
      // del conjunto recortado responde justo eso.
      marchita: isPlantWilted(streak, cumplidoEseDia, hasta.size > 0),
      algunaVezCumplido: hasta.size > 0,
      cumplidoEseDia,
      programadoEseDia: estaProgramado(calendario, dia),
    });
  }
  return plantas;
}

/**
 * El primer día con memoria que enseñar: el registro más antiguo que haya.
 *
 * Nulo si no hay ninguno. Sin registros no hay pasado, y una barra de tiempo de
 * un solo día es peor que ninguna barra.
 */
export function primerDiaConDatos(habitos: HabitoHistorico[]): Date | null {
  let min: number | null = null;
  for (const h of habitos) {
    for (const t of h.cumplidos) {
      if (min === null || t < min) min = t;
    }
  }
  return min === null ? null : new Date(min);
}

/**
 * Los días cumplidos y fallados de la semana que acaba en `dia`.
 *
 * Es `getDiasCumplidos` reconstruido sin base de datos, y repite su regla al
 * pie de la letra: un día cuenta solo si algún hábito vigente lo tenía
 * programado, y se da por cumplido si TODOS ellos lo cumplieron. Los días sin
 * nada programado —fin de semana, pausa, jardín aún vacío— no caen en ninguno
 * de los dos conjuntos, que es lo que hace que unas vacaciones lleguen al clima
 * como cero y cero en vez de como una semana de fallos.
 */
export function semanaEn(
  habitos: HabitoHistorico[],
  dia: Date,
): { cumplidos: number; fallados: number } {
  const plenosPorDia = new Map<number, Set<string>>();
  for (const h of habitos) {
    for (const t of h.plenos) {
      const set = plenosPorDia.get(t);
      if (set) set.add(h.id);
      else plenosPorDia.set(t, new Set([h.id]));
    }
  }

  let cumplidos = 0;
  let fallados = 0;
  for (let i = 6; i >= 0; i -= 1) {
    const d = addDays(dia, -i);
    const t = d.getTime();
    const vigentes = habitos.filter(
      (h) =>
        h.creado.getTime() <= t && estaProgramado(cal(h.schedule, h.pausas), d),
    );
    if (vigentes.length === 0) continue;
    const hechos = plenosPorDia.get(t) ?? new Set<string>();
    if (vigentes.every((h) => hechos.has(h.id))) cumplidos += 1;
    else fallados += 1;
  }
  return { cumplidos, fallados };
}
