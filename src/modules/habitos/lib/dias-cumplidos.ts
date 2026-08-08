import { and, asc, gte, lte } from "drizzle-orm";
import type { Db } from "@/modules/core/db";
import { habits as habitsTable, habitLogs } from "@/modules/habitos/schema";
import { addDays, dayKey, normalizeDayKey } from "./day";
import { cal, estaProgramado, sanitizeSchedule } from "./calendario";
import { pausasPorHabito } from "./pausas";
import { cumplidosPorDia } from "./cantidad";

export type DiasCumplidos = {
  /** Días en que se cumplió TODO lo programado. */
  cumplidos: Set<number>;
  /** Días en que tocaba algo y no se cumplió todo. */
  fallados: Set<number>;
};

/**
 * Parte los días en cumplidos y fallados.
 *
 * Un día es CUMPLIDO si todos los hábitos que tocaban ese día están marcados sin
 * modo mínimo. Misma definición que la racha global y que la misión «día
 * completo», para no inventar un tercer criterio de lo mismo.
 *
 * Tres clases de día quedan FUERA de los dos conjuntos:
 *
 *   · los que no tocaba nada — no había nada que cumplir;
 *   · los que lo que tocaba estaba en pausa — igual;
 *   · los anteriores a que existiera cada hábito.
 *
 * Lo de la pausa importa: si contara como fallado, una pausa larga sería una
 * racha de fallos y torcería cualquier comparación que se haga con esto.
 */
export async function getDiasCumplidos(
  db: Db,
  desde: Date,
  hasta: Date,
): Promise<DiasCumplidos> {
  const a = normalizeDayKey(desde);
  const b = normalizeDayKey(hasta);

  const [filas, logs, pausas] = await Promise.all([
    db
      .select({
        id: habitsTable.id,
        schedule: habitsTable.schedule,
        createdAt: habitsTable.createdAt,
        targetCount: habitsTable.targetCount,
      })
      .from(habitsTable)
      .orderBy(asc(habitsTable.createdAt)),
    db
      .select({
        habitId: habitLogs.habitId,
        date: habitLogs.date,
        partial: habitLogs.partial,
        count: habitLogs.count,
      })
      .from(habitLogs)
      .where(and(gte(habitLogs.date, a), lte(habitLogs.date, b))),
    pausasPorHabito(db),
  ]);

  const specs = filas.map((h) => ({
    id: h.id,
    calendario: cal(sanitizeSchedule(h.schedule), pausas.get(h.id) ?? []),
    desde: dayKey(h.createdAt),
  }));

  /*
    La MISMA regla que las rachas, no una propia. Antes esto filtraba solo por
    `partial` y se saltaba el objetivo: con 2 de 8 vasos el clima daba el día por
    cumplido mientras la racha de ese hábito seguía a cero.
  */
  const plenos = cumplidosPorDia(
    logs.map((l) => ({
      habitId: l.habitId,
      date: l.date,
      partial: !!l.partial,
      count: l.count,
    })),
    new Map(filas.map((h) => [h.id, h.targetCount])),
  );

  const cumplidos = new Set<number>();
  const fallados = new Set<number>();

  for (let d = a; d.getTime() <= b.getTime(); d = addDays(d, 1)) {
    const t = d.getTime();
    const vigentes = specs.filter(
      (s) => s.desde.getTime() <= t && estaProgramado(s.calendario, d),
    );
    // Nada que cumplir: fuera de los dos conjuntos.
    if (vigentes.length === 0) continue;

    const hechos = plenos.get(t) ?? new Set<string>();
    if (vigentes.every((s) => hechos.has(s.id))) cumplidos.add(t);
    else fallados.add(t);
  }

  return { cumplidos, fallados };
}
