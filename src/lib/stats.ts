import { prisma } from "./prisma";
import { startOfDayUTC } from "./habits";

export type HabitDetailStats = {
  totalDone: number;
  completionRate30: number; // 0..1 over last 30 days
  bestStreak: number;
  currentStreak: number;
  daysSinceCreated: number;
};

export async function getHabitStats(habitId: string): Promise<HabitDetailStats> {
  const habit = await prisma.habit.findUnique({
    where: { id: habitId },
    include: { logs: { orderBy: { date: "asc" } } },
  });
  if (!habit) {
    return {
      totalDone: 0,
      completionRate30: 0,
      bestStreak: 0,
      currentStreak: 0,
      daysSinceCreated: 0,
    };
  }

  const today = startOfDayUTC();
  const dates = new Set(
    habit.logs.map((l) => startOfDayUTC(l.date).getTime()),
  );
  const totalDone = habit.logs.length;

  // last 30 days
  let last30Done = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    if (dates.has(d.getTime())) last30Done += 1;
  }

  // best streak (scan ascending)
  const sortedDates = [...dates].sort((a, b) => a - b);
  let bestStreak = 0;
  let runningStreak = 0;
  let prev: number | null = null;
  for (const t of sortedDates) {
    if (prev === null) {
      runningStreak = 1;
    } else {
      const diff = (t - prev) / (24 * 60 * 60 * 1000);
      runningStreak = diff === 1 ? runningStreak + 1 : 1;
    }
    if (runningStreak > bestStreak) bestStreak = runningStreak;
    prev = t;
  }

  // current streak (scan back from today)
  let currentStreak = 0;
  const cursor = new Date(today);
  if (!dates.has(cursor.getTime())) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  while (dates.has(cursor.getTime())) {
    currentStreak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  const daysSinceCreated = Math.max(
    1,
    Math.ceil(
      (today.getTime() - startOfDayUTC(habit.createdAt).getTime()) /
        (24 * 60 * 60 * 1000),
    ) + 1,
  );

  return {
    totalDone,
    completionRate30: last30Done / 30,
    bestStreak,
    currentStreak,
    daysSinceCreated,
  };
}

export type GlobalStats = {
  totalCompletions: number;
  todayCompletions: number;
  weekCompletions: number;
  bestWeekday: { weekday: number; count: number } | null;
  heatmap: { date: string; count: number }[]; // last 84 days (12 weeks), oldest first
};

const WEEKDAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export function weekdayName(idx: number) {
  return WEEKDAY_NAMES[idx] ?? "?";
}

export async function getGlobalStats(): Promise<GlobalStats> {
  const today = startOfDayUTC();
  const cutoff = new Date(today);
  cutoff.setUTCDate(cutoff.getUTCDate() - 83);

  const logs = await prisma.habitLog.findMany({
    where: { date: { gte: cutoff } },
    select: { date: true },
  });

  const byDay = new Map<number, number>();
  const byWeekday = new Map<number, number>();
  for (const l of logs) {
    const dayMs = startOfDayUTC(l.date).getTime();
    byDay.set(dayMs, (byDay.get(dayMs) ?? 0) + 1);
    const wd = new Date(l.date).getUTCDay();
    byWeekday.set(wd, (byWeekday.get(wd) ?? 0) + 1);
  }

  const heatmap: { date: string; count: number }[] = [];
  for (let i = 83; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    heatmap.push({
      date: d.toISOString().slice(0, 10),
      count: byDay.get(d.getTime()) ?? 0,
    });
  }

  // current week (last 7 days incl today)
  let weekCompletions = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    weekCompletions += byDay.get(d.getTime()) ?? 0;
  }

  let bestWeekday: GlobalStats["bestWeekday"] = null;
  for (const [wd, c] of byWeekday) {
    if (!bestWeekday || c > bestWeekday.count) bestWeekday = { weekday: wd, count: c };
  }

  // total all-time (one extra query)
  const totalCompletions = await prisma.habitLog.count();

  return {
    totalCompletions,
    todayCompletions: byDay.get(today.getTime()) ?? 0,
    weekCompletions,
    bestWeekday,
    heatmap,
  };
}
