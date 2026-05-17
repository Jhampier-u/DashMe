import { prisma } from "./prisma";
import { startOfDayUTC } from "./habits";

export type QuestKind =
  | "QUEST_3_HABITS"
  | "QUEST_EARLY"
  | "QUEST_TASK"
  | "QUEST_TREE"
  | "QUEST_PERFECT";

export type QuestDef = {
  kind: QuestKind;
  label: string;
  description: string;
  emoji: string;
  target: number;
  xpReward: number;
};

export const QUEST_DEFS: Record<QuestKind, QuestDef> = {
  QUEST_3_HABITS: {
    kind: "QUEST_3_HABITS",
    label: "Trío del día",
    description: "Completa 3 hábitos hoy",
    emoji: "🎯",
    target: 3,
    xpReward: 50,
  },
  QUEST_EARLY: {
    kind: "QUEST_EARLY",
    label: "Madrugador",
    description: "Marca 1 hábito antes de las 10:00",
    emoji: "🌅",
    target: 1,
    xpReward: 30,
  },
  QUEST_TASK: {
    kind: "QUEST_TASK",
    label: "Productividad",
    description: "Completa 2 tareas",
    emoji: "📝",
    target: 2,
    xpReward: 40,
  },
  QUEST_TREE: {
    kind: "QUEST_TREE",
    label: "Constructor",
    description: "Completa 1 subtarea de proyecto",
    emoji: "🌳",
    target: 1,
    xpReward: 30,
  },
  QUEST_PERFECT: {
    kind: "QUEST_PERFECT",
    label: "Día perfecto",
    description: "Cumple TODOS tus hábitos hoy",
    emoji: "🏆",
    target: 1,
    xpReward: 100,
  },
};

const ALL_KINDS: QuestKind[] = Object.keys(QUEST_DEFS) as QuestKind[];

// Deterministic daily picks based on date — same set if we revisit, different across days.
function hashDate(d: Date): number {
  const s = d.toISOString().slice(0, 10);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function pickQuestsForDate(d: Date, count = 3): QuestKind[] {
  const seed = hashDate(d);
  const pool = [...ALL_KINDS];
  const out: QuestKind[] = [];
  let s = seed;
  while (out.length < count && pool.length > 0) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const idx = s % pool.length;
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

export type DailyQuestRow = {
  id: string;
  kind: QuestKind;
  target: number;
  progress: number;
  xpReward: number;
  completed: boolean;
};

export async function ensureDailyQuests(): Promise<DailyQuestRow[]> {
  const today = startOfDayUTC();
  const kinds = pickQuestsForDate(today, 3);

  // upsert each
  for (const kind of kinds) {
    const def = QUEST_DEFS[kind];
    await prisma.dailyQuest.upsert({
      where: { date_kind: { date: today, kind } },
      update: {},
      create: {
        date: today,
        kind,
        target: def.target,
        xpReward: def.xpReward,
      },
    });
  }

  const rows = await prisma.dailyQuest.findMany({
    where: { date: today },
    orderBy: { kind: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind as QuestKind,
    target: r.target,
    progress: r.progress,
    xpReward: r.xpReward,
    completed: r.completed,
  }));
}

export async function getTodayQuests(): Promise<DailyQuestRow[]> {
  const today = startOfDayUTC();
  const rows = await prisma.dailyQuest.findMany({
    where: { date: today },
    orderBy: { kind: "asc" },
  });
  // If empty (first hit), generate
  if (rows.length === 0) {
    return ensureDailyQuests();
  }
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind as QuestKind,
    target: r.target,
    progress: r.progress,
    xpReward: r.xpReward,
    completed: r.completed,
  }));
}
