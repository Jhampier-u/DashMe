import { prisma } from "./prisma";
import { dayKey, localDayRange } from "./day";
import { isScheduledOn } from "./streak";

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

export const EARLY_QUEST_HOUR = 10;

// Selección determinista por fecha: el mismo set si vuelves a entrar,
// distinto cada día.
function hashDate(d: Date): number {
  const s = d.toISOString().slice(0, 10);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function pickQuestsForDate(d: Date, count = 3): QuestKind[] {
  const pool = [...ALL_KINDS];
  const out: QuestKind[] = [];
  let s = hashDate(d);
  while (out.length < count && pool.length > 0) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    out.push(pool.splice(s % pool.length, 1)[0]);
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

export type QuestCompletion = {
  kind: QuestKind;
  label: string;
  xp: number;
  emoji: string;
};

/**
 * Progreso REAL de cada misión, recalculado desde los datos.
 *
 * Antes el progreso era un contador que se incrementaba a mano en cada acción
 * y se decrementaba al deshacer, lo que se desincronizaba en cuanto algo se
 * salía del guion (misión ya completada, hábito borrado, backfill…).
 * Recalcular es igual de barato aquí y no puede quedar desfasado.
 */
async function computeProgress(now: Date): Promise<Record<QuestKind, number>> {
  const today = dayKey(now);
  const { start, end } = localDayRange(now);
  const earlyCutoff = new Date(start.getTime());
  earlyCutoff.setHours(EARLY_QUEST_HOUR, 0, 0, 0);

  const [todayLogs, habits, tasksDone, itemsDone] = await Promise.all([
    prisma.habitLog.findMany({
      where: { date: today, shielded: false },
      select: { habitId: true, partial: true, createdAt: true },
    }),
    prisma.habit.findMany({ select: { id: true, schedule: true } }),
    prisma.task.count({
      where: { status: "DONE", completedAt: { gte: start, lt: end } },
    }),
    prisma.projectItem.count({
      where: { status: "DONE", completedAt: { gte: start, lt: end } },
    }),
  ]);

  const scheduledToday = habits.filter((h) => isScheduledOn(h.schedule, today));
  const fullyDone = new Set(
    todayLogs.filter((l) => !l.partial).map((l) => l.habitId),
  );
  const perfect =
    scheduledToday.length > 0 &&
    scheduledToday.every((h) => fullyDone.has(h.id));

  const early = todayLogs.some((l) => l.createdAt.getTime() < earlyCutoff.getTime());

  return {
    QUEST_3_HABITS: todayLogs.length,
    QUEST_EARLY: early ? 1 : 0,
    QUEST_TASK: tasksDone,
    QUEST_TREE: itemsDone,
    QUEST_PERFECT: perfect ? 1 : 0,
  };
}

async function ensureRows(today: Date) {
  const kinds = pickQuestsForDate(today, 3);
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
  return prisma.dailyQuest.findMany({
    where: { date: today },
    orderBy: { kind: "asc" },
  });
}

export type QuestSyncResult = {
  xpDelta: number;
  completed: QuestCompletion[];
};

/**
 * Recalcula el progreso, paga las misiones recién completadas y devuelve el XP
 * de las que dejaron de estarlo. El pago y la devolución son simétricos, así
 * que marcar y desmarcar en bucle no genera XP.
 */
export async function syncDailyQuests(
  now: Date = new Date(),
): Promise<QuestSyncResult> {
  const today = dayKey(now);
  const [rows, progress] = await Promise.all([
    ensureRows(today),
    computeProgress(now),
  ]);

  let xpDelta = 0;
  const completed: QuestCompletion[] = [];

  for (const row of rows) {
    const kind = row.kind as QuestKind;
    const def = QUEST_DEFS[kind];
    if (!def) continue;
    const value = progress[kind] ?? 0;
    const reached = value >= row.target;

    if (reached && !row.completed) {
      // updateMany con guardia: si dos acciones corren a la vez, solo una paga.
      const { count } = await prisma.dailyQuest.updateMany({
        where: { id: row.id, completed: false },
        data: { progress: value, completed: true, completedAt: now },
      });
      if (count === 1) {
        xpDelta += row.xpReward;
        completed.push({
          kind,
          label: def.label,
          xp: row.xpReward,
          emoji: def.emoji,
        });
      }
    } else if (!reached && row.completed) {
      const { count } = await prisma.dailyQuest.updateMany({
        where: { id: row.id, completed: true },
        data: { progress: value, completed: false, completedAt: null },
      });
      if (count === 1) xpDelta -= row.xpReward;
    } else if (row.progress !== value) {
      await prisma.dailyQuest.update({
        where: { id: row.id },
        data: { progress: value },
      });
    }
  }

  return { xpDelta, completed };
}

/** Misiones de hoy para pintar el panel. No concede ni retira XP. */
export async function getTodayQuests(): Promise<DailyQuestRow[]> {
  const now = new Date();
  const today = dayKey(now);
  const [rows, progress] = await Promise.all([
    ensureRows(today),
    computeProgress(now),
  ]);
  return rows
    .filter((r) => QUEST_DEFS[r.kind as QuestKind])
    .map((r) => ({
      id: r.id,
      kind: r.kind as QuestKind,
      target: r.target,
      progress: Math.min(
        r.target,
        progress[r.kind as QuestKind] ?? r.progress,
      ),
      xpReward: r.xpReward,
      completed: r.completed,
    }));
}
