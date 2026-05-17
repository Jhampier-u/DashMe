import { prisma } from "./prisma";
import {
  getLevelInfo,
  MAX_SHIELDS,
  SHIELD_REGEN_DAYS,
  type LevelInfo,
} from "./level";
import type { PlantSpecies } from "./garden";

export function startOfDayUTC(d: Date = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// Schedule helpers: schedule is a 7-char string of "1"/"0", indexed by getUTCDay() (0=Sun..6=Sat).
export const DEFAULT_SCHEDULE = "1111111";

export function isScheduledOn(schedule: string, date: Date): boolean {
  const sched = (schedule ?? DEFAULT_SCHEDULE).padEnd(7, "0").slice(0, 7);
  const idx = date.getUTCDay();
  return sched[idx] === "1";
}

export function isScheduledDaily(schedule: string): boolean {
  return (schedule ?? DEFAULT_SCHEDULE) === DEFAULT_SCHEDULE;
}

// Find the most recent scheduled day strictly before "from" (inclusive of cap days back).
function previousScheduledDay(
  schedule: string,
  from: Date,
  maxBackDays = 14,
): Date | null {
  for (let i = 1; i <= maxBackDays; i++) {
    const d = new Date(from);
    d.setUTCDate(d.getUTCDate() - i);
    if (isScheduledOn(schedule, d)) return d;
  }
  return null;
}

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
  const today = startOfDayUTC();
  const habits = await prisma.habit.findMany({
    orderBy: [{ isAnchor: "desc" }, { createdAt: "asc" }],
    include: {
      logs: { orderBy: { date: "desc" }, take: 120 },
      _count: { select: { logs: true } },
    },
  });

  return habits.map((h) => {
    const schedule = h.schedule ?? DEFAULT_SCHEDULE;
    const dates = new Set(h.logs.map((l) => startOfDayUTC(l.date).getTime()));
    const todayLog = h.logs.find(
      (l) => startOfDayUTC(l.date).getTime() === today.getTime(),
    );
    const doneToday = !!todayLog;
    const partialToday = !!todayLog?.partial;
    const scheduledToday = isScheduledOn(schedule, today);

    // streak: walk back through SCHEDULED days only, counting "done"
    let streak = 0;
    {
      const cursor = new Date(today);
      if (!doneToday || !scheduledToday) {
        // start from yesterday's most recent scheduled day
        cursor.setUTCDate(cursor.getUTCDate() - 1);
      }
      for (let i = 0; i < 365; i++) {
        if (cursor.getTime() < 0) break;
        if (isScheduledOn(schedule, cursor)) {
          if (dates.has(cursor.getTime())) {
            streak += 1;
          } else {
            break;
          }
        }
        cursor.setUTCDate(cursor.getUTCDate() - 1);
      }
    }

    // critical today: scheduled today, not done today, AND previous scheduled day was missed
    let criticalToday = false;
    if (scheduledToday && !doneToday) {
      const prev = previousScheduledDay(schedule, today, 14);
      if (prev && !dates.has(prev.getTime()) && h._count.logs > 0) {
        criticalToday = true;
      }
    }

    const last30: boolean[] = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      last30.push(dates.has(d.getTime()));
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
      doneToday,
      partialToday,
      scheduledToday,
      criticalToday,
      streak,
      hasEverBeenDone: h._count.logs > 0,
      last30,
    };
  });
}

export async function getOrCreatePlayer() {
  const player = await prisma.player.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default", xp: 0 },
  });

  const now = new Date();
  const elapsedDays =
    (now.getTime() - player.shieldsUpdated.getTime()) / (24 * 60 * 60 * 1000);
  const earned = Math.floor(elapsedDays / SHIELD_REGEN_DAYS);
  if (earned > 0 && player.shields < MAX_SHIELDS) {
    const newShields = Math.min(MAX_SHIELDS, player.shields + earned);
    return prisma.player.update({
      where: { id: "default" },
      data: { shields: newShields, shieldsUpdated: now },
    });
  }
  return player;
}

export async function getPlayerLevelInfo(): Promise<
  LevelInfo & { shields: number }
> {
  const player = await getOrCreatePlayer();
  const info = getLevelInfo(player.xp);
  return { ...info, shields: player.shields };
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
};

export async function getHabitMonth(
  habitId: string,
  year: number,
  monthIndex: number,
): Promise<MonthDay[]> {
  const habit = await prisma.habit.findUnique({
    where: { id: habitId },
    include: { logs: true },
  });
  if (!habit) return [];

  const schedule = habit.schedule ?? DEFAULT_SCHEDULE;
  const logByDate = new Map<number, { partial: boolean; shielded: boolean }>();
  for (const l of habit.logs) {
    logByDate.set(startOfDayUTC(l.date).getTime(), {
      partial: !!l.partial,
      shielded: !!l.shielded,
    });
  }
  const today = startOfDayUTC();

  const first = new Date(Date.UTC(year, monthIndex, 1));
  const startWeekday = first.getUTCDay();
  const lastOfMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

  const out: MonthDay[] = [];
  function makeDay(d: Date, inMonth: boolean): MonthDay {
    const t = d.getTime();
    const meta = logByDate.get(t);
    return {
      date: d.toISOString().slice(0, 10),
      day: d.getUTCDate(),
      isToday: t === today.getTime(),
      isFuture: t > today.getTime(),
      inMonth,
      scheduled: isScheduledOn(schedule, d),
      done: !!meta,
      partial: meta?.partial ?? false,
      shielded: meta?.shielded ?? false,
    };
  }

  for (let i = startWeekday - 1; i >= 0; i--) {
    const d = new Date(first);
    d.setUTCDate(first.getUTCDate() - (i + 1));
    out.push(makeDay(d, false));
  }
  for (let day = 1; day <= lastOfMonth; day++) {
    const d = new Date(Date.UTC(year, monthIndex, day));
    out.push(makeDay(d, true));
  }
  while (out.length % 7 !== 0) {
    const last = new Date(out[out.length - 1].date + "T00:00:00Z");
    last.setUTCDate(last.getUTCDate() + 1);
    out.push(makeDay(last, false));
  }
  return out;
}
