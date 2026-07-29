import { asc, gte } from "drizzle-orm";
import type { Db } from "@/modules/core/db";
import { habits as habitsTable, habitLogs } from "@/modules/habitos/schema";
import { addDays, dayKey, normalizeDayKey } from "./day";
import { computeStreak, isCriticalDay, isScheduledOn } from "./streak";
import { diasQueCuentan, type LogParaRacha } from "./cantidad";
import {
  bestWeekday,
  buildHabitSpecs,
  complianceSeries,
  periodDelta,
  rollingMean,
  type DayCompliance,
  type PeriodDelta,
  type WeekdayRate,
} from "./metrics";

/** Días de historial que se cargan de una vez; el rango se recorta en cliente. */
export const HISTORY_DAYS = 365;
/** Cuatro semanas exactas: ambos periodos tienen los mismos días de la semana. */
export const COMPARISON_DAYS = 28;
export const MEAN_WINDOW = 7;

export type PendingHabit = {
  id: string;
  name: string;
  critical: boolean;
};

export type HomeMetrics = {
  /** Cuántos hábitos existen, para decidir el estado vacío. */
  habitCount: number;
  today: {
    scheduled: number;
    done: number;
    /** Cuántos de los cumplidos de hoy lo fueron en modo mínimo. */
    partial: number;
    pending: PendingHabit[];
  };
  /** La racha viva más larga, si hay alguna. */
  longestStreak: { days: number; habitName: string } | null;
  series: DayCompliance[];
  mean: (number | null)[];
  delta: PeriodDelta | null;
  best: WeekdayRate | null;
};

export async function getHomeMetrics(db: Db): Promise<HomeMetrics> {
  const today = dayKey();
  const from = addDays(today, -(HISTORY_DAYS - 1));

  const [habits, logs] = await Promise.all([
    db
      .select({
        id: habitsTable.id,
        name: habitsTable.name,
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
        shielded: habitLogs.shielded,
        count: habitLogs.count,
      })
      .from(habitLogs)
      .where(gte(habitLogs.date, from)),
  ]);

  const entries = logs.map((l) => ({
    habitId: l.habitId,
    day: normalizeDayKey(l.date),
    partial: l.partial,
    shielded: l.shielded,
    count: l.count,
  }));

  // Un hábito cuenta desde su creación o desde su registro más antiguo, lo que
  // sea anterior: rellenar hacia atrás no debe dejar días fuera del denominador.
  const specs = buildHabitSpecs(
    habits.map((h) => ({ id: h.id, schedule: h.schedule, createdKey: dayKey(h.createdAt) })),
    entries,
  );

  const series = complianceSeries(specs, entries, from, today);
  const mean = rollingMean(series.map((d) => d.rate), MEAN_WINDOW);

  // Días cumplidos por hábito, para reutilizar la regla de los 2 días ya
  // probada en lib/streak en vez de reimplementar "ayer".
  // Pasa por `diasQueCuentan` y no se construye a mano: con un objetivo, un día
  // corto NO cuenta para la racha, y esta era una de las cinco copias de la
  // regla que había que unificar.
  const objetivoPorHabito = new Map(habits.map((h) => [h.id, h.targetCount]));
  const logsPorHabito = new Map<string, LogParaRacha[]>();
  for (const entry of entries) {
    const l = { date: entry.day, partial: entry.partial, count: entry.count };
    const lista = logsPorHabito.get(entry.habitId);
    if (lista) lista.push(l);
    else logsPorHabito.set(entry.habitId, [l]);
  }
  const keysByHabit = new Map<string, Set<number>>();
  for (const [id, propios] of logsPorHabito) {
    keysByHabit.set(
      id,
      diasQueCuentan(propios, objetivoPorHabito.get(id) ?? null),
    );
  }

  // Registros de hoy no cubiertos por escudo: id de hábito -> ¿fue parcial?
  // Se necesita el valor de `partial`, no solo si está hecho, porque el
  // titular de "Hoy" debe matizar cuántos de los cumplidos fueron en modo
  // mínimo (la gráfica ya los cuenta al 50%).
  const todayDoneMap = new Map<string, boolean>();
  for (const entry of entries) {
    if (entry.day.getTime() === today.getTime() && !entry.shielded) {
      todayDoneMap.set(entry.habitId, entry.partial);
    }
  }
  const doneToday = new Set(todayDoneMap.keys());
  const scheduledToday = habits.filter((h) => isScheduledOn(h.schedule, today));

  // Racha viva más larga entre todos los hábitos, reutilizando el mismo
  // calendario y las mismas claves que usa la tarjeta de hábito individual.
  // Los hábitos vienen ordenados por createdAt ascendente, así que en un
  // empate gana el primero (comparación estrictamente mayor).
  let longestStreak: { days: number; habitName: string } | null = null;
  for (const h of habits) {
    const keys = keysByHabit.get(h.id) ?? new Set<number>();
    const streak = computeStreak(h.schedule, keys, today);
    if (streak > 0 && (longestStreak === null || streak > longestStreak.days)) {
      longestStreak = { days: streak, habitName: h.name };
    }
  }

  return {
    habitCount: habits.length,
    today: {
      scheduled: scheduledToday.length,
      done: scheduledToday.filter((h) => doneToday.has(h.id)).length,
      partial: scheduledToday.filter((h) => todayDoneMap.get(h.id) === true).length,
      pending: scheduledToday
        .filter((h) => !doneToday.has(h.id))
        .map((h) => {
          const keys = keysByHabit.get(h.id) ?? new Set<number>();
          return {
            id: h.id,
            name: h.name,
            critical: isCriticalDay(h.schedule, keys, today, keys.size > 0),
          };
        }),
    },
    longestStreak,
    series,
    mean,
    delta: periodDelta(series, COMPARISON_DAYS),
    best: bestWeekday(series.slice(-COMPARISON_DAYS * 3)),
  };
}
