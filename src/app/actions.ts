"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { startOfDayUTC, getOrCreatePlayer, isScheduledOn } from "@/lib/habits";
import {
  XP_PER_HABIT,
  XP_PER_TASK,
  levelFromXp,
  getLevelInfo,
  milestoneFor,
} from "@/lib/level";
import type { TaskStatus } from "@/lib/tasks";
import type { ProjectItemStatus } from "@/lib/projects";
import type { PlantSpecies } from "@/lib/garden";
import { QUEST_DEFS, type QuestKind } from "@/lib/quests";

// ---------- HELPERS ----------

async function applyXpDelta(delta: number) {
  const player = await getOrCreatePlayer();
  const oldLevel = levelFromXp(player.xp);
  const newXp = Math.max(0, player.xp + delta);
  const updated = await prisma.player.update({
    where: { id: "default" },
    data: { xp: newXp },
  });
  const info = getLevelInfo(updated.xp);
  return { oldLevel, info, shields: updated.shields };
}

type QuestComplete = { kind: QuestKind; label: string; xp: number; emoji: string };

async function bumpQuestProgress(
  kinds: QuestKind[],
): Promise<{ totalReward: number; completed: QuestComplete[] }> {
  const today = startOfDayUTC();
  let totalReward = 0;
  const completed: QuestComplete[] = [];
  for (const kind of kinds) {
    const q = await prisma.dailyQuest.findUnique({
      where: { date_kind: { date: today, kind } },
    });
    if (!q || q.completed) continue;
    const newProgress = q.progress + 1;
    const isDone = newProgress >= q.target;
    await prisma.dailyQuest.update({
      where: { id: q.id },
      data: {
        progress: newProgress,
        completed: isDone,
        completedAt: isDone ? new Date() : null,
      },
    });
    if (isDone) {
      totalReward += q.xpReward;
      const def = QUEST_DEFS[kind];
      completed.push({
        kind,
        label: def.label,
        xp: q.xpReward,
        emoji: def.emoji,
      });
    }
  }
  return { totalReward, completed };
}

async function decrementQuestProgress(kinds: QuestKind[]) {
  const today = startOfDayUTC();
  for (const kind of kinds) {
    await prisma.dailyQuest.updateMany({
      where: { date: today, kind, completed: false, progress: { gt: 0 } },
      data: { progress: { decrement: 1 } },
    });
  }
}

async function trySpendShield(
  habitId: string,
  today: Date,
): Promise<boolean> {
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const dayBefore = new Date(today);
  dayBefore.setUTCDate(dayBefore.getUTCDate() - 2);

  const [yLog, dbLog] = await Promise.all([
    prisma.habitLog.findUnique({
      where: { habitId_date: { habitId, date: yesterday } },
    }),
    prisma.habitLog.findUnique({
      where: { habitId_date: { habitId, date: dayBefore } },
    }),
  ]);
  if (yLog) return false;
  if (!dbLog) return false;

  const player = await getOrCreatePlayer();
  if (player.shields <= 0) return false;

  await prisma.player.update({
    where: { id: "default" },
    data: { shields: player.shields - 1 },
  });
  await prisma.habitLog.create({
    data: { habitId, date: yesterday, shielded: true },
  });
  return true;
}

async function isPerfectDayAfter(today: Date): Promise<boolean> {
  const habits = await prisma.habit.findMany({
    select: { id: true, schedule: true },
  });
  const scheduledToday = habits.filter((h) =>
    isScheduledOn(h.schedule ?? "1111111", today),
  );
  if (scheduledToday.length === 0) return false;
  const logs = await prisma.habitLog.findMany({
    where: {
      date: today,
      habitId: { in: scheduledToday.map((h) => h.id) },
    },
    select: { habitId: true },
  });
  return logs.length === scheduledToday.length;
}

// ---------- HABITS ----------

function sanitizeSchedule(s: string): string {
  const cleaned = (s ?? "").replace(/[^01]/g, "").padEnd(7, "0").slice(0, 7);
  if (cleaned === "0000000") return "1111111";
  return cleaned;
}

export async function createHabit(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const icon = String(formData.get("icon") ?? "⭐").trim() || "⭐";
  const color = String(formData.get("color") ?? "mint");
  const plantSpecies = (String(formData.get("plantSpecies") ?? "flower")) as PlantSpecies;
  const minimalGoal = String(formData.get("minimalGoal") ?? "").trim() || null;
  const schedule = sanitizeSchedule(String(formData.get("schedule") ?? "1111111"));
  const intention = String(formData.get("intention") ?? "").trim() || null;
  const isAnchor = formData.get("isAnchor") === "on" || formData.get("isAnchor") === "true";

  if (!name) return;
  if (isAnchor) {
    await prisma.habit.updateMany({
      where: { isAnchor: true },
      data: { isAnchor: false },
    });
  }
  await prisma.habit.create({
    data: {
      name, icon, color, plantSpecies, minimalGoal,
      schedule, intention, isAnchor,
    },
  });
  revalidatePath("/", "layout");
}

export async function setHabitAnchor(habitId: string, makeAnchor: boolean) {
  if (!habitId) return;
  if (makeAnchor) {
    await prisma.habit.updateMany({
      where: { isAnchor: true },
      data: { isAnchor: false },
    });
  }
  await prisma.habit.update({
    where: { id: habitId },
    data: { isAnchor: makeAnchor },
  });
  revalidatePath("/", "layout");
}

export async function updateHabitSchedule(habitId: string, schedule: string) {
  if (!habitId) return;
  await prisma.habit.update({
    where: { id: habitId },
    data: { schedule: sanitizeSchedule(schedule) },
  });
  revalidatePath("/", "layout");
}

export async function updateHabitIntention(habitId: string, intention: string) {
  if (!habitId) return;
  const t = intention.trim();
  await prisma.habit.update({
    where: { id: habitId },
    data: { intention: t.length ? t : null },
  });
  revalidatePath("/", "layout");
}

export async function deleteHabit(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.habit.delete({ where: { id } });
  revalidatePath("/", "layout");
}

export type ToggleResult = {
  doneToday: boolean;
  partial: boolean;
  xpDelta: number;
  leveledUp: boolean;
  newLevel: number;
  xp: number;
  progress: number;
  shields: number;
  shieldUsed: boolean;
  anchorTriggered: boolean;
  milestone: { habitName: string; days: number; bonus: number } | null;
  questsCompleted: QuestComplete[];
};

const EMPTY_TOGGLE: ToggleResult = {
  doneToday: false,
  partial: false,
  xpDelta: 0,
  leveledUp: false,
  newLevel: 1,
  xp: 0,
  progress: 0,
  shields: 0,
  shieldUsed: false,
  anchorTriggered: false,
  milestone: null,
  questsCompleted: [],
};

export async function toggleToday(
  habitId: string,
  partial = false,
): Promise<ToggleResult> {
  if (!habitId) return EMPTY_TOGGLE;
  const habit = await prisma.habit.findUnique({ where: { id: habitId } });
  if (!habit) return EMPTY_TOGGLE;

  const today = startOfDayUTC();

  // refuse if not scheduled today
  if (!isScheduledOn(habit.schedule ?? "1111111", today)) {
    return EMPTY_TOGGLE;
  }

  const existing = await prisma.habitLog.findUnique({
    where: { habitId_date: { habitId, date: today } },
  });

  let xpDelta = 0;
  let nowDone = false;
  let nowPartial = false;
  let milestone: ToggleResult["milestone"] = null;
  let shieldUsed = false;
  let anchorTriggered = false;
  let questsCompleted: QuestComplete[] = [];

  if (existing) {
    // un-toggle
    await prisma.habitLog.delete({ where: { id: existing.id } });
    xpDelta = -(existing.partial ? Math.floor(XP_PER_HABIT / 2) : XP_PER_HABIT);
    // decrement quest progress (best-effort)
    const kinds: QuestKind[] = ["QUEST_3_HABITS"];
    if (new Date().getHours() < 10) kinds.push("QUEST_EARLY");
    await decrementQuestProgress(kinds);
  } else {
    // create log
    await prisma.habitLog.create({
      data: { habitId, date: today, partial },
    });
    xpDelta = partial ? Math.floor(XP_PER_HABIT / 2) : XP_PER_HABIT;
    if (habit.isAnchor && !partial) {
      xpDelta += 10; // anchor bonus
      anchorTriggered = true;
    }
    nowDone = true;
    nowPartial = partial;

    // shield gap-fill (only if becoming fully done, not partial — partials don't deserve shielding)
    if (!partial) {
      shieldUsed = await trySpendShield(habitId, today);
    }

    // milestone — recompute streak after marking
    const fresh = await prisma.habit.findUnique({
      where: { id: habitId },
      include: { logs: { orderBy: { date: "desc" } } },
    });
    if (fresh) {
      const dates = new Set(
        fresh.logs.map((l) => startOfDayUTC(l.date).getTime()),
      );
      let streak = 0;
      const cursor = new Date(today);
      while (dates.has(cursor.getTime())) {
        streak += 1;
        cursor.setUTCDate(cursor.getUTCDate() - 1);
      }
      const m = milestoneFor(streak);
      if (m) {
        xpDelta += m.bonus;
        milestone = { habitName: habit.name, days: m.days, bonus: m.bonus };
      }
    }

    // bump quests
    const bumpKinds: QuestKind[] = ["QUEST_3_HABITS"];
    if (new Date().getHours() < 10) bumpKinds.push("QUEST_EARLY");
    if (await isPerfectDayAfter(today)) bumpKinds.push("QUEST_PERFECT");
    const bumped = await bumpQuestProgress(bumpKinds);
    xpDelta += bumped.totalReward;
    questsCompleted = bumped.completed;
  }

  const { oldLevel, info, shields } = await applyXpDelta(xpDelta);
  revalidatePath("/", "layout");

  return {
    doneToday: nowDone,
    partial: nowPartial,
    xpDelta,
    leveledUp: info.level > oldLevel,
    newLevel: info.level,
    xp: info.xp,
    progress: info.progress,
    shields,
    shieldUsed,
    anchorTriggered,
    milestone,
    questsCompleted,
  };
}

export async function toggleHabitOnDay(
  habitId: string,
  isoDate: string,
): Promise<ToggleResult> {
  if (!habitId || !isoDate) return EMPTY_TOGGLE;

  const target = startOfDayUTC(new Date(isoDate + "T00:00:00Z"));
  const today = startOfDayUTC();
  if (target.getTime() > today.getTime()) return EMPTY_TOGGLE;
  const diffDays = (today.getTime() - target.getTime()) / (24 * 60 * 60 * 1000);
  if (diffDays > 60) return EMPTY_TOGGLE;

  const existing = await prisma.habitLog.findUnique({
    where: { habitId_date: { habitId, date: target } },
  });

  let xpDelta = 0;
  let nowDone = false;
  if (existing) {
    await prisma.habitLog.delete({ where: { id: existing.id } });
    xpDelta = -XP_PER_HABIT;
  } else {
    await prisma.habitLog.create({ data: { habitId, date: target } });
    xpDelta = XP_PER_HABIT;
    nowDone = true;
  }

  const { oldLevel, info, shields } = await applyXpDelta(xpDelta);
  revalidatePath("/", "layout");

  return {
    ...EMPTY_TOGGLE,
    doneToday: nowDone,
    xpDelta,
    leveledUp: info.level > oldLevel,
    newLevel: info.level,
    xp: info.xp,
    progress: info.progress,
    shields,
  };
}

// ---------- TASKS ----------

export async function createTask(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  if (!title) return;
  const last = await prisma.task.findFirst({
    where: { status: "TODO" },
    orderBy: { order: "desc" },
  });
  await prisma.task.create({
    data: { title, description, status: "TODO", order: (last?.order ?? 0) + 1 },
  });
  revalidatePath("/", "layout");
}

export type TaskUpdateResult = {
  becameDone: boolean;
  xpDelta: number;
  leveledUp: boolean;
  newLevel: number;
  xp: number;
  progress: number;
  questsCompleted: QuestComplete[];
};

export async function updateTaskStatus(
  taskId: string,
  newStatus: TaskStatus,
): Promise<TaskUpdateResult> {
  const empty: TaskUpdateResult = {
    becameDone: false,
    xpDelta: 0,
    leveledUp: false,
    newLevel: 1,
    xp: 0,
    progress: 0,
    questsCompleted: [],
  };
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return empty;

  const wasDone = task.status === "DONE";
  const willBeDone = newStatus === "DONE";

  let xpDelta = 0;
  if (!wasDone && willBeDone) xpDelta = XP_PER_TASK;
  if (wasDone && !willBeDone) xpDelta = -XP_PER_TASK;

  await prisma.task.update({
    where: { id: taskId },
    data: { status: newStatus, completedAt: willBeDone ? new Date() : null },
  });

  let questsCompleted: QuestComplete[] = [];
  if (!wasDone && willBeDone) {
    const bumped = await bumpQuestProgress(["QUEST_TASK"]);
    xpDelta += bumped.totalReward;
    questsCompleted = bumped.completed;
  } else if (wasDone && !willBeDone) {
    await decrementQuestProgress(["QUEST_TASK"]);
  }

  const { oldLevel, info } = await applyXpDelta(xpDelta);
  revalidatePath("/", "layout");

  return {
    becameDone: !wasDone && willBeDone,
    xpDelta,
    leveledUp: info.level > oldLevel,
    newLevel: info.level,
    xp: info.xp,
    progress: info.progress,
    questsCompleted,
  };
}

export async function deleteTask(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.task.delete({ where: { id } });
  revalidatePath("/", "layout");
}

// ---------- PROJECTS ----------

const PROJECT_ICONS = ["📁", "🎯", "🚀", "🎨", "🎮", "📚", "💼", "🏗️", "🌟", "🧪", "🎵", "🌱"];
const PROJECT_COLORS = ["lavender", "mint", "peach", "sky", "pink"];

export async function createProject(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const icon = String(formData.get("icon") ?? "📁");
  const color = String(formData.get("color") ?? "lavender");
  if (!name) return;
  await prisma.project.create({
    data: {
      name,
      description,
      icon: PROJECT_ICONS.includes(icon) ? icon : "📁",
      color: PROJECT_COLORS.includes(color) ? color : "lavender",
    },
  });
  revalidatePath("/projects");
  revalidatePath("/", "layout");
}

export async function deleteProject(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.project.delete({ where: { id } });
  revalidatePath("/projects");
  revalidatePath("/", "layout");
}

export async function createProjectItem(
  projectId: string,
  parentId: string | null,
  title: string,
) {
  const t = title.trim();
  if (!projectId || !t) return;
  const last = await prisma.projectItem.findFirst({
    where: { projectId, parentId },
    orderBy: { order: "desc" },
  });
  await prisma.projectItem.create({
    data: {
      projectId,
      parentId,
      title: t,
      order: (last?.order ?? 0) + 1,
      status: "TODO",
    },
  });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/", "layout");
}

export type ItemStatusResult = {
  becameDone: boolean;
  xpDelta: number;
  leveledUp: boolean;
  newLevel: number;
  xp: number;
  progress: number;
  questsCompleted: QuestComplete[];
};

export async function updateProjectItemStatus(
  itemId: string,
  newStatus: ProjectItemStatus,
): Promise<ItemStatusResult> {
  const empty: ItemStatusResult = {
    becameDone: false,
    xpDelta: 0,
    leveledUp: false,
    newLevel: 1,
    xp: 0,
    progress: 0,
    questsCompleted: [],
  };
  const item = await prisma.projectItem.findUnique({ where: { id: itemId } });
  if (!item) return empty;

  const wasDone = item.status === "DONE";
  const willBeDone = newStatus === "DONE";

  let xpDelta = 0;
  if (!wasDone && willBeDone) xpDelta = XP_PER_TASK;
  if (wasDone && !willBeDone) xpDelta = -XP_PER_TASK;

  await prisma.projectItem.update({
    where: { id: itemId },
    data: { status: newStatus, completedAt: willBeDone ? new Date() : null },
  });

  let questsCompleted: QuestComplete[] = [];
  if (!wasDone && willBeDone) {
    const bumped = await bumpQuestProgress(["QUEST_TREE"]);
    xpDelta += bumped.totalReward;
    questsCompleted = bumped.completed;
  } else if (wasDone && !willBeDone) {
    await decrementQuestProgress(["QUEST_TREE"]);
  }

  const { oldLevel, info } = await applyXpDelta(xpDelta);
  revalidatePath(`/projects/${item.projectId}`);
  revalidatePath("/", "layout");

  return {
    becameDone: !wasDone && willBeDone,
    xpDelta,
    leveledUp: info.level > oldLevel,
    newLevel: info.level,
    xp: info.xp,
    progress: info.progress,
    questsCompleted,
  };
}

export async function deleteProjectItem(itemId: string) {
  if (!itemId) return;
  const item = await prisma.projectItem.findUnique({ where: { id: itemId } });
  if (!item) return;
  await prisma.projectItem.delete({ where: { id: itemId } });
  revalidatePath(`/projects/${item.projectId}`);
  revalidatePath("/", "layout");
}

export async function renameProjectItem(itemId: string, newTitle: string) {
  const t = newTitle.trim();
  if (!itemId || !t) return;
  const item = await prisma.projectItem.update({
    where: { id: itemId },
    data: { title: t },
  });
  revalidatePath(`/projects/${item.projectId}`);
}
