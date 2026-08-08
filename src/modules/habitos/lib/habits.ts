import { and, asc, count, desc, eq, gte, inArray } from "drizzle-orm";
import type { Db } from "@/modules/core/db";
import {
  habits as habitsTable,
  habitLogs,
  habitNotes,
  player as playerTable,
} from "@/modules/habitos/schema";
import {
  getLevelInfo,
  MAX_SHIELDS,
  SHIELD_REGEN_DAYS,
  type LevelInfo,
} from "./level";
import type { PlantSpecies } from "./garden";
import {
  addDays,
  dayKey,
  isoFromDayKey,
  MS_PER_DAY,
  normalizeDayKey,
} from "./day";
import {
  rachaDetallada,
  DEFAULT_SCHEDULE,
  isCriticalDay,
  isScheduledOn,
  sanitizeSchedule,
} from "./streak";
import { daysSince } from "./flow";
import { diasQueCuentan } from "./cantidad";
import { cal, enPausa, estaProgramado, type Rango } from "./calendario";
import { pausasDeHabito, pausasPorHabito } from "./pausas";
import {
  averageRate,
  buildHabitSpecs,
  complianceSeries,
  weekdayRates,
  worstWeekday,
  type LogEntry,
} from "./metrics";

/** Ventana máxima que se lee de historial para calcular rachas. */
const STREAK_LOOKBACK_DAYS = 400;

export type HabitWithStatus = {
  id: string;
  name: string;
  icon: string;
  color: string;
  plantSpecies: PlantSpecies;
  minimalGoal: string | null;
  isAnchor: boolean;
  schedule: string;
  intention: string | null;
  doneToday: boolean;
  /** Si hay registro hoy, esté completo o no. Ver la nota en la construcción. */
  registradoHoy: boolean;
  partialToday: boolean;
  /** Objetivo numérico del día. Nulo = este hábito no se cuenta. */
  targetCount: number | null;
  /** Su hueco en el jardín tal y como está en la base. Nulo = aún sin sitio. */
  gardenSlot: number | null;
  /** La nota de hoy, si la hay. */
  notaHoy: string | null;
  /** Si hoy cae dentro de una pausa. */
  enPausaHoy: boolean;
  /** Lo apuntado hoy. Nulo si no se apuntó. */
  countToday: number | null;
  scheduledToday: boolean;
  criticalToday: boolean;
  streak: number;
  /** Fallos que esa racha ha absorbido. 0 o 1. Se dice en pantalla. */
  rachaPerdonados: number;
  hasEverBeenDone: boolean;
  last30: boolean[];
};

export async function getHabitsWithTodayStatus(
  db: Db,
): Promise<HabitWithStatus[]> {
  const today = dayKey();
  const cutoff = addDays(today, -STREAK_LOOKBACK_DAYS);

  const habits = await db
    .select()
    .from(habitsTable)
    .orderBy(desc(habitsTable.isAnchor), asc(habitsTable.createdAt));

  const ids = habits.map((h) => h.id);

  // Sin hábitos no hay nada que consultar, y un inArray con lista vacía genera
  // SQL inválido en SQLite.
  const logs = ids.length
    ? await db
        .select()
        .from(habitLogs)
        .where(
          and(inArray(habitLogs.habitId, ids), gte(habitLogs.date, cutoff)),
        )
        .orderBy(desc(habitLogs.date))
    : [];

  // Conteo total SIN filtro de fecha: es el equivalente al _count de Prisma.
  // Calcularlo sobre `logs`, que viene recortado a la ventana de rachas, haría
  // que un hábito cumplido hace más de STREAK_LOOKBACK_DAYS figurase como nunca
  // cumplido. No da error: simplemente miente, y el jardín lo pinta de semilla.
  const totales = ids.length
    ? await db
        .select({ habitId: habitLogs.habitId, n: count() })
        .from(habitLogs)
        .where(inArray(habitLogs.habitId, ids))
        .groupBy(habitLogs.habitId)
    : [];

  const logsPorHabito = new Map<string, typeof logs>();
  for (const l of logs) {
    const lista = logsPorHabito.get(l.habitId);
    if (lista) lista.push(l);
    else logsPorHabito.set(l.habitId, [l]);
  }

  const totalPorHabito = new Map(totales.map((t) => [t.habitId, t.n]));

  // Las notas de hoy, en una consulta aparte: viven en su propia tabla porque una
  // nota no depende de que el día esté marcado.
  const notasHoy = ids.length
    ? await db
        .select({ habitId: habitNotes.habitId, text: habitNotes.text })
        .from(habitNotes)
        .where(
          and(inArray(habitNotes.habitId, ids), eq(habitNotes.date, today)),
        )
    : [];
  const notaPorHabito = new Map(notasHoy.map((n) => [n.habitId, n.text]));
  // Las pausas de verdad. Con ellas, `estaProgramado` deja de ser un alias de
  // `isScheduledOn` y los días pausados salen del calendario.
  const pausasPorId: Map<string, Rango[]> = await pausasPorHabito(db);

  return habits.map((h) => {
    const hLogs = logsPorHabito.get(h.id) ?? [];
    const schedule = sanitizeSchedule(h.schedule);
    const calendario = cal(schedule, pausasPorId.get(h.id) ?? []);
    const doneKeys = diasQueCuentan(
      hLogs.map((l) => ({
        date: l.date,
        partial: !!l.partial,
        count: l.count,
      })),
      h.targetCount,
    );
    const todayLog = hLogs.find(
      (l) => normalizeDayKey(l.date).getTime() === today.getTime(),
    );
    const hasEverBeenDone = (totalPorHabito.get(h.id) ?? 0) > 0;
    const racha = rachaDetallada(calendario, doneKeys, today);

    const last30: boolean[] = [];
    for (let i = 0; i < 30; i++) {
      last30.push(doneKeys.has(addDays(today, -i).getTime()));
    }

    return {
      id: h.id,
      name: h.name,
      icon: h.icon,
      color: h.color,
      plantSpecies: (h.plantSpecies as PlantSpecies) ?? "flower",
      minimalGoal: h.minimalGoal,
      isAnchor: !!h.isAnchor,
      schedule,
      intention: h.intention,
      /*
        Sale de `doneKeys`, que es el MISMO conjunto del que salen la racha,
        `last30` y el día crítico. Antes era `!!todayLog` —basta con que exista un
        registro— y el mismo objeto se contradecía: con un objetivo de 8 y 2
        apuntados decía `doneToday: true` y `last30[0]: false` a la vez.

        Atarlo a `doneKeys` no es solo arreglarlo: hace imposible que vuelvan a
        divergir, porque ya no hay dos cálculos que mantener de acuerdo.
      */
      doneToday: doneKeys.has(today.getTime()),
      /**
       * Si HAY registro hoy, complete o no. Es otra pregunta y hace falta
       * aparte: el botón de marcar BORRA el registro existente, así que quien
       * decida si se puede pulsar tiene que mirar esto y no `doneToday`. Si
       * mirara `doneToday`, pulsar sobre un 2 de 8 borraría los 2.
       */
      registradoHoy: !!todayLog,
      partialToday: !!todayLog?.partial,
      targetCount: h.targetCount,
      gardenSlot: h.gardenSlot,
      notaHoy: notaPorHabito.get(h.id) ?? null,
      // Se expone aparte de `scheduledToday` a propósito: los dos serán falsos
      // hoy, pero la fila tiene que poder decir POR QUÉ. Sin esto, un hábito
      // pausado parece simplemente desaparecido.
      enPausaHoy: enPausa(pausasPorId.get(h.id) ?? [], today),
      countToday: todayLog?.count ?? null,
      scheduledToday: estaProgramado(calendario, today),
      criticalToday: isCriticalDay(
        calendario,
        doneKeys,
        today,
        hasEverBeenDone,
      ),
      streak: racha.dias,
      /*
        Se expone para que el cartel pueda decir que la racha ha perdonado un
        día. Enseñar un número limpio que no lo es sería la misma mentira de
        representación que Silverman y Barasch (2022) miden en las rachas: lo que
        mueve la conducta es lo que el registro ENSEÑA, no lo que hiciste.
      */
      rachaPerdonados: racha.perdonados,
      hasEverBeenDone,
      last30,
    };
  });
}

/**
 * Devuelve el jugador, regenerando escudos si toca.
 *
 * El bug anterior: `shieldsUpdated` solo se tocaba al regenerar, así que
 * estando al máximo el reloj quedaba congelado en el pasado y el primer
 * escudo gastado se recuperaba al instante. Ahora el reloj también avanza
 * mientras estás lleno, y al regenerar se conserva el resto del periodo.
 */
export async function getOrCreatePlayer(db: Db) {
  const ahora = new Date();
  // Drizzle no tiene upsert-sin-cambios: insert + onConflictDoNothing y luego
  // leer. Los defaults de fecha los ponía Prisma con @default(now()); aquí van
  // explícitos porque el esquema los declara notNull.
  await db
    .insert(playerTable)
    .values({
      id: "default",
      xp: 0,
      shieldsUpdated: ahora,
      createdAt: ahora,
      updatedAt: ahora,
    })
    .onConflictDoNothing({ target: playerTable.id });

  const [player] = await db
    .select()
    .from(playerTable)
    .where(eq(playerTable.id, "default"))
    .limit(1);

  const now = new Date();
  const regenMs = SHIELD_REGEN_DAYS * MS_PER_DAY;
  const elapsed = now.getTime() - player.shieldsUpdated.getTime();
  const earned = Math.floor(elapsed / regenMs);
  if (earned <= 0) return player;

  if (player.shields >= MAX_SHIELDS) {
    // Lleno: no hay nada que ganar, pero el contador arranca de nuevo.
    const [row] = await db
      .update(playerTable)
      .set({ shieldsUpdated: now, updatedAt: now })
      .where(eq(playerTable.id, "default"))
      .returning();
    return row;
  }

  const newShields = Math.min(MAX_SHIELDS, player.shields + earned);
  const shieldsUpdated =
    newShields >= MAX_SHIELDS
      ? now
      : new Date(player.shieldsUpdated.getTime() + earned * regenMs);

  const [row] = await db
    .update(playerTable)
    .set({ shields: newShields, shieldsUpdated, updatedAt: now })
    .where(eq(playerTable.id, "default"))
    .returning();
  return row;
}

export async function getPlayerLevelInfo(
  db: Db,
): Promise<LevelInfo & { shields: number }> {
  const player = await getOrCreatePlayer(db);
  return { ...getLevelInfo(player), shields: player.shields };
}

export type MonthDay = {
  date: string;
  day: number;
  isToday: boolean;
  isFuture: boolean;
  inMonth: boolean;
  scheduled: boolean;
  done: boolean;
  partial: boolean;
  shielded: boolean;
  editable: boolean;
};

/** Cuántos días atrás se puede rellenar el calendario. */
export const BACKFILL_MAX_DAYS = 60;

export async function getHabitMonth(
  db: Db,
  habitId: string,
  year: number,
  monthIndex: number,
): Promise<MonthDay[]> {
  if (!Number.isInteger(year) || year < 2000 || year > 2999) return [];
  if (!Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return [];
  }

  const [habit] = await db
    .select()
    .from(habitsTable)
    .where(eq(habitsTable.id, habitId))
    .limit(1);
  if (!habit) return [];

  const registros = await db
    .select()
    .from(habitLogs)
    .where(eq(habitLogs.habitId, habitId));

  const schedule = sanitizeSchedule(habit.schedule);
  // El calendario del mes pinta apagados los días no programados, y un día en
  // pausa es exactamente eso: se ven apagados sin tocar nada más.
  const calendarioMes = cal(schedule, await pausasDeHabito(db, habitId));
  const logByDate = new Map<number, { partial: boolean; shielded: boolean }>();
  for (const l of registros) {
    logByDate.set(normalizeDayKey(l.date).getTime(), {
      partial: !!l.partial,
      shielded: !!l.shielded,
    });
  }

  const today = dayKey();
  const oldestEditable = addDays(today, -BACKFILL_MAX_DAYS);

  function makeDay(d: Date, inMonth: boolean): MonthDay {
    const t = d.getTime();
    const meta = logByDate.get(t);
    const isFuture = t > today.getTime();
    // El calendario del mes pinta apagados los días no programados, y una pausa
    // es exactamente eso: así los días en pausa se ven apagados sin tocar nada
    // más.
    const scheduled = estaProgramado(calendarioMes, d);
    return {
      date: isoFromDayKey(d),
      day: d.getUTCDate(),
      isToday: t === today.getTime(),
      isFuture,
      inMonth,
      scheduled,
      done: !!meta,
      partial: meta?.partial ?? false,
      shielded: meta?.shielded ?? false,
      editable: !isFuture && scheduled && t >= oldestEditable.getTime(),
    };
  }

  const first = new Date(Date.UTC(year, monthIndex, 1));
  const startWeekday = first.getUTCDay();
  const lastOfMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

  const out: MonthDay[] = [];
  for (let i = startWeekday; i > 0; i--) {
    out.push(makeDay(addDays(first, -i), false));
  }
  for (let day = 1; day <= lastOfMonth; day++) {
    out.push(makeDay(new Date(Date.UTC(year, monthIndex, day)), true));
  }
  while (out.length % 7 !== 0) {
    const last = out[out.length - 1];
    out.push(makeDay(addDays(new Date(last.date + "T00:00:00Z"), 1), false));
  }
  return out;
}

export { DEFAULT_SCHEDULE, isScheduledOn, sanitizeSchedule };

/** Ventana del diagnóstico: cuatro semanas exactas. */
export const DIAGNOSIS_DAYS = 28;

export type HabitRanking = {
  id: string;
  name: string;
  icon: string;
  /** Cumplimiento sobre los días que le tocaban a él. `null` si no tocó ninguno. */
  rate: number | null;
  /** Días que le tocaban dentro de la ventana. */
  scheduled: number;
};

export type HabitUntouched = {
  id: string;
  name: string;
  days: number;
  /** Si nunca se ha cumplido, se cuenta desde que se creó y se dice. */
  from: "completion" | "creation";
};

export type HabitDiagnosis = {
  ranking: HabitRanking[];
  /** Siete posiciones, 0=domingo. `null` donde no hay datos. */
  weekdays: (number | null)[];
  worst: { weekday: number; rate: number } | null;
  untouched: HabitUntouched[];
};

export async function getHabitDiagnosis(db: Db): Promise<HabitDiagnosis> {
  const today = dayKey();
  const from = addDays(today, -(DIAGNOSIS_DAYS - 1));

  const [habits, logs] = await Promise.all([
    db
      .select({
        id: habitsTable.id,
        name: habitsTable.name,
        icon: habitsTable.icon,
        schedule: habitsTable.schedule,
        createdAt: habitsTable.createdAt,
      })
      .from(habitsTable)
      .orderBy(asc(habitsTable.createdAt)),
    db
      .select({
        habitId: habitLogs.habitId,
        date: habitLogs.date,
        partial: habitLogs.partial,
        shielded: habitLogs.shielded,
      })
      .from(habitLogs)
      .where(gte(habitLogs.date, from)),
  ]);

  const entries: LogEntry[] = logs.map((l) => ({
    habitId: l.habitId,
    day: normalizeDayKey(l.date),
    partial: l.partial,
    shielded: l.shielded,
  }));

  const specs = buildHabitSpecs(
    habits.map((h) => ({
      id: h.id,
      schedule: h.schedule,
      createdKey: dayKey(h.createdAt),
    })),
    entries,
  );

  // El ranking mide cada hábito sobre SUS días: uno de lunes y viernes con 7 de
  // 8 está al 88%, no al 25%. Por eso se llama a complianceSeries con un solo
  // hábito en vez de repartir el agregado.
  const ranking: HabitRanking[] = habits.map((habit) => {
    const spec = specs.find((s) => s.id === habit.id)!;
    const series = complianceSeries(
      [spec],
      entries.filter((e) => e.habitId === habit.id),
      from,
      today,
    );
    return {
      id: habit.id,
      name: habit.name,
      icon: habit.icon,
      rate: averageRate(series),
      scheduled: series.filter((d) => d.scheduled > 0).length,
    };
  });

  // Del peor al mejor. Los que no tuvieron ningún día programado van al final:
  // no se les puede reprochar nada.
  ranking.sort((a, b) => {
    if (a.rate === null) return b.rate === null ? 0 : 1;
    if (b.rate === null) return -1;
    return a.rate - b.rate;
  });

  const overall = complianceSeries(specs, entries, from, today);

  const lastByHabit = new Map<string, number>();
  for (const entry of entries) {
    if (entry.shielded) continue;
    const t = entry.day.getTime();
    const previous = lastByHabit.get(entry.habitId);
    if (previous === undefined || t > previous)
      lastByHabit.set(entry.habitId, t);
  }

  const untouched: HabitUntouched[] = habits
    .map((habit) => {
      const last = lastByHabit.get(habit.id);
      return last === undefined
        ? {
            id: habit.id,
            name: habit.name,
            days: daysSince(habit.createdAt, today),
            from: "creation" as const,
          }
        : {
            id: habit.id,
            name: habit.name,
            days: daysSince(new Date(last), today),
            from: "completion" as const,
          };
    })
    .sort((a, b) => b.days - a.days);

  return {
    ranking,
    weekdays: weekdayRates(overall),
    worst: worstWeekday(overall),
    untouched,
  };
}
