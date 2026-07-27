import { prisma } from "./prisma";
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
  computeStreak,
  DEFAULT_SCHEDULE,
  isCriticalDay,
  isScheduledOn,
  sanitizeSchedule,
} from "./streak";

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
  partialToday: boolean;
  scheduledToday: boolean;
  criticalToday: boolean;
  streak: number;
  hasEverBeenDone: boolean;
  last30: boolean[];
};

export async function getHabitsWithTodayStatus(): Promise<HabitWithStatus[]> {
  const today = dayKey();
  const cutoff = addDays(today, -STREAK_LOOKBACK_DAYS);

  const habits = await prisma.habit.findMany({
    orderBy: [{ isAnchor: "desc" }, { createdAt: "asc" }],
    include: {
      logs: {
        where: { date: { gte: cutoff } },
        orderBy: { date: "desc" },
      },
      _count: { select: { logs: true } },
    },
  });

  return habits.map((h) => {
    const schedule = sanitizeSchedule(h.schedule);
    const doneKeys = new Set(
      h.logs.map((l) => normalizeDayKey(l.date).getTime()),
    );
    const todayLog = h.logs.find(
      (l) => normalizeDayKey(l.date).getTime() === today.getTime(),
    );
    const hasEverBeenDone = h._count.logs > 0;

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
      doneToday: !!todayLog,
      partialToday: !!todayLog?.partial,
      scheduledToday: isScheduledOn(schedule, today),
      criticalToday: isCriticalDay(schedule, doneKeys, today, hasEverBeenDone),
      streak: computeStreak(schedule, doneKeys, today),
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
export async function getOrCreatePlayer() {
  const player = await prisma.player.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default", xp: 0 },
  });

  const now = new Date();
  const regenMs = SHIELD_REGEN_DAYS * MS_PER_DAY;
  const elapsed = now.getTime() - player.shieldsUpdated.getTime();
  const earned = Math.floor(elapsed / regenMs);
  if (earned <= 0) return player;

  if (player.shields >= MAX_SHIELDS) {
    // Lleno: no hay nada que ganar, pero el contador arranca de nuevo.
    return prisma.player.update({
      where: { id: "default" },
      data: { shieldsUpdated: now },
    });
  }

  const newShields = Math.min(MAX_SHIELDS, player.shields + earned);
  const shieldsUpdated =
    newShields >= MAX_SHIELDS
      ? now
      : new Date(player.shieldsUpdated.getTime() + earned * regenMs);

  return prisma.player.update({
    where: { id: "default" },
    data: { shields: newShields, shieldsUpdated },
  });
}

export async function getPlayerLevelInfo(): Promise<
  LevelInfo & { shields: number }
> {
  const player = await getOrCreatePlayer();
  return { ...getLevelInfo(player.xp), shields: player.shields };
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
  habitId: string,
  year: number,
  monthIndex: number,
): Promise<MonthDay[]> {
  if (!Number.isInteger(year) || year < 2000 || year > 2999) return [];
  if (!Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return [];
  }

  const habit = await prisma.habit.findUnique({
    where: { id: habitId },
    include: { logs: true },
  });
  if (!habit) return [];

  const schedule = sanitizeSchedule(habit.schedule);
  const logByDate = new Map<number, { partial: boolean; shielded: boolean }>();
  for (const l of habit.logs) {
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
    const scheduled = isScheduledOn(schedule, d);
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
