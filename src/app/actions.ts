"use server";

import { refresh } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  BACKFILL_MAX_DAYS,
  getOrCreatePlayer,
  getHabitMonth,
} from "@/lib/habits";
import {
  addDays,
  dayKey,
  dayKeyFromISO,
  daysBetween,
  normalizeDayKey,
} from "@/lib/day";
import {
  computeStreak,
  isScheduledOn,
  previousScheduledDay,
  sanitizeSchedule,
} from "@/lib/streak";
import {
  ANCHOR_BONUS,
  MAX_SHIELDS,
  XP_PER_HABIT,
  XP_PER_TASK,
  getLevelInfo,
  levelFromXp,
  milestoneFor,
  type LevelInfo,
} from "@/lib/level";
import { TASK_STATUSES, type TaskStatus } from "@/lib/tasks";
import { PROJECT_ITEM_STATUSES, type ProjectItemStatus } from "@/lib/projects";
import { PLANT_SPECIES, type PlantSpecies } from "@/lib/garden";
import { syncDailyQuests, type QuestCompletion } from "@/lib/quests";
import { getHabitStats } from "@/lib/stats";

// ---------- LÍMITES / VALIDACIÓN ----------

const LIMITS = {
  habitName: 60,
  habitIcon: 8,
  minimalGoal: 80,
  intention: 140,
  taskTitle: 120,
  taskDescription: 500,
  projectName: 60,
  projectDescription: 300,
  itemTitle: 200,
} as const;

const HABIT_COLORS = ["mint", "peach", "pink", "lavender", "sky"] as const;
const PROJECT_ICONS = ["📁", "🎯", "🚀", "🎨", "🎮", "📚", "💼", "🏗️", "🌟", "🧪", "🎵", "🌱"];
const PROJECT_COLORS = ["lavender", "mint", "peach", "sky", "pink"];

const SPECIES_KEYS = PLANT_SPECIES.map((s) => s.key);

/** Recorta y normaliza texto de formulario. Devuelve null si queda vacío. */
function text(value: FormDataEntryValue | null, max: number): string | null {
  const t = String(value ?? "").trim().slice(0, max);
  return t.length ? t : null;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

// ---------- JUGADOR / XP ----------

export type PlayerSnapshot = LevelInfo & { shields: number };

/**
 * Aplica un delta de XP de forma atómica (`increment`), sin leer-modificar-
 * escribir: dos clicks simultáneos ya no se pisan.
 */
async function grantXp(delta: number): Promise<{
  oldLevel: number;
  player: PlayerSnapshot;
}> {
  const current = await getOrCreatePlayer();
  if (delta === 0) {
    return {
      oldLevel: levelFromXp(current.xp),
      player: { ...getLevelInfo(current.xp), shields: current.shields },
    };
  }

  const updated = await prisma.player.update({
    where: { id: "default" },
    data: { xp: { increment: delta } },
  });

  let xp = updated.xp;
  if (xp < 0) {
    xp = 0;
    await prisma.player.update({ where: { id: "default" }, data: { xp: 0 } });
  }

  return {
    oldLevel: levelFromXp(Math.max(0, updated.xp - delta)),
    player: { ...getLevelInfo(xp), shields: updated.shields },
  };
}

async function playerSnapshot(): Promise<PlayerSnapshot> {
  const player = await getOrCreatePlayer();
  return { ...getLevelInfo(player.xp), shields: player.shields };
}

// ---------- ESCUDOS ----------

async function refundShield() {
  await prisma.player.updateMany({
    where: { id: "default", shields: { lt: MAX_SHIELDS } },
    data: { shields: { increment: 1 } },
  });
}

/**
 * Rellena con un escudo el hueco del día programado anterior.
 *
 * Ahora respeta el calendario del hábito: si tu hábito es L-M-V y ayer era
 * martes, el hueco a cubrir es el lunes, no "ayer".
 */
async function trySpendShield(
  habit: { id: string; schedule: string | null },
  today: Date,
): Promise<boolean> {
  const schedule = sanitizeSchedule(habit.schedule);
  const gap = previousScheduledDay(schedule, today, 14);
  if (!gap) return false;
  const before = previousScheduledDay(schedule, gap, 14);
  if (!before) return false;

  const [gapLog, beforeLog] = await Promise.all([
    prisma.habitLog.findUnique({
      where: { habitId_date: { habitId: habit.id, date: gap } },
    }),
    prisma.habitLog.findUnique({
      where: { habitId_date: { habitId: habit.id, date: before } },
    }),
  ]);
  if (gapLog) return false; // no hay hueco
  if (!beforeLog) return false; // no había racha que salvar

  // Guardia atómica: nunca gasta un escudo que no existe.
  const { count } = await prisma.player.updateMany({
    where: { id: "default", shields: { gt: 0 } },
    data: { shields: { decrement: 1 } },
  });
  if (count !== 1) return false;

  try {
    await prisma.habitLog.create({
      data: { habitId: habit.id, date: gap, shielded: true, xpAwarded: 0 },
    });
    return true;
  } catch {
    await refundShield();
    return false;
  }
}

// ---------- HÁBITOS ----------

export type ToggleResult = {
  ok: boolean;
  reason: "ok" | "not-found" | "not-scheduled" | "out-of-range";
  done: boolean;
  partial: boolean;
  xpDelta: number;
  leveledUp: boolean;
  player: PlayerSnapshot;
  shieldUsed: boolean;
  anchorTriggered: boolean;
  milestone: { habitName: string; days: number; bonus: number } | null;
  questsCompleted: QuestCompletion[];
};

async function emptyToggle(
  reason: ToggleResult["reason"],
): Promise<ToggleResult> {
  return {
    ok: false,
    reason,
    done: false,
    partial: false,
    xpDelta: 0,
    leveledUp: false,
    player: await playerSnapshot(),
    shieldUsed: false,
    anchorTriggered: false,
    milestone: null,
    questsCompleted: [],
  };
}

/**
 * Marca o desmarca un hábito en un día concreto.
 *
 * Toda la contabilidad de XP pasa por aquí y queda grabada en
 * `HabitLog.xpAwarded`, así que desmarcar devuelve exactamente lo que se
 * concedió — incluidos el bonus de ancla y el de hito. Antes desmarcar
 * devolvía solo la base, y marcar/desmarcar en bucle era XP gratis.
 */
async function toggleHabitDay(
  habitId: string,
  key: Date,
  partial: boolean,
): Promise<ToggleResult> {
  const habit = await prisma.habit.findUnique({ where: { id: habitId } });
  if (!habit) return emptyToggle("not-found");

  const today = dayKey();
  if (key.getTime() > today.getTime()) return emptyToggle("out-of-range");
  if (daysBetween(today, key) > BACKFILL_MAX_DAYS) {
    return emptyToggle("out-of-range");
  }

  const schedule = sanitizeSchedule(habit.schedule);
  if (!isScheduledOn(schedule, key)) return emptyToggle("not-scheduled");

  const isToday = key.getTime() === today.getTime();
  const existing = await prisma.habitLog.findUnique({
    where: { habitId_date: { habitId, date: key } },
  });

  let logXpDelta = 0;
  let done = false;
  let nowPartial = false;
  let shieldUsed = false;
  let anchorTriggered = false;
  let milestone: ToggleResult["milestone"] = null;

  if (existing) {
    await prisma.habitLog.delete({ where: { id: existing.id } });
    logXpDelta = -existing.xpAwarded;
    // Si borras un día cubierto por un escudo, se te devuelve.
    if (existing.shielded) await refundShield();
  } else {
    const base = partial ? Math.floor(XP_PER_HABIT / 2) : XP_PER_HABIT;
    anchorTriggered = habit.isAnchor && !partial;
    let awarded = base + (anchorTriggered ? ANCHOR_BONUS : 0);

    const created = await prisma.habitLog.create({
      data: { habitId, date: key, partial, xpAwarded: awarded },
    });
    done = true;
    nowPartial = partial;

    // Hito: se calcula sobre la racha real (respetando el calendario) y su
    // bonus queda grabado en el propio registro para poder devolverlo.
    const streak = await currentStreakOf(habitId, schedule, today);
    const m = milestoneFor(streak);
    if (m) {
      awarded += m.bonus;
      await prisma.habitLog.update({
        where: { id: created.id },
        data: { xpAwarded: awarded },
      });
      milestone = { habitName: habit.name, days: m.days, bonus: m.bonus };
    }
    logXpDelta = awarded;

    if (isToday && !partial) {
      shieldUsed = await trySpendShield({ id: habitId, schedule }, today);
    }
  }

  const quests = await syncDailyQuests();
  const { oldLevel, player } = await grantXp(logXpDelta + quests.xpDelta);
  refresh();

  return {
    ok: true,
    reason: "ok",
    done,
    partial: nowPartial,
    xpDelta: logXpDelta + quests.xpDelta,
    leveledUp: player.level > oldLevel,
    player,
    shieldUsed,
    anchorTriggered,
    milestone,
    questsCompleted: quests.completed,
  };
}

async function currentStreakOf(
  habitId: string,
  schedule: string,
  today: Date,
): Promise<number> {
  const logs = await prisma.habitLog.findMany({
    where: { habitId, date: { gte: addDays(today, -400) } },
    select: { date: true },
  });
  const keys = new Set(logs.map((l) => normalizeDayKey(l.date).getTime()));
  return computeStreak(schedule, keys, today);
}

export async function toggleToday(
  habitId: string,
  partial = false,
): Promise<ToggleResult> {
  if (!habitId) return emptyToggle("not-found");
  return toggleHabitDay(habitId, dayKey(), partial);
}

export async function toggleHabitOnDay(
  habitId: string,
  isoDate: string,
): Promise<ToggleResult> {
  if (!habitId) return emptyToggle("not-found");
  const key = dayKeyFromISO(isoDate);
  if (!key) return emptyToggle("out-of-range");
  return toggleHabitDay(habitId, key, false);
}

export async function createHabit(formData: FormData) {
  const name = text(formData.get("name"), LIMITS.habitName);
  if (!name) return;

  const icon = text(formData.get("icon"), LIMITS.habitIcon) ?? "⭐";
  const color = oneOf(formData.get("color"), HABIT_COLORS, "mint");
  const plantSpecies = oneOf<PlantSpecies>(
    formData.get("plantSpecies"),
    SPECIES_KEYS,
    "flower",
  );
  const minimalGoal = text(formData.get("minimalGoal"), LIMITS.minimalGoal);
  const intention = text(formData.get("intention"), LIMITS.intention);
  const schedule = sanitizeSchedule(String(formData.get("schedule") ?? ""));
  const isAnchor =
    formData.get("isAnchor") === "on" || formData.get("isAnchor") === "true";

  if (isAnchor) {
    await prisma.habit.updateMany({
      where: { isAnchor: true },
      data: { isAnchor: false },
    });
  }
  await prisma.habit.create({
    data: { name, icon, color, plantSpecies, minimalGoal, schedule, intention, isAnchor },
  });

  // Un hábito nuevo puede deshacer el "día perfecto" que ya estaba pagado.
  const quests = await syncDailyQuests();
  await grantXp(quests.xpDelta);
  refresh();
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
  refresh();
}

export async function updateHabitSchedule(habitId: string, schedule: string) {
  if (!habitId) return;
  await prisma.habit.update({
    where: { id: habitId },
    data: { schedule: sanitizeSchedule(schedule) },
  });
  const quests = await syncDailyQuests();
  await grantXp(quests.xpDelta);
  refresh();
}

export async function updateHabitIntention(habitId: string, intention: string) {
  if (!habitId) return;
  await prisma.habit.update({
    where: { id: habitId },
    data: { intention: intention.trim().slice(0, LIMITS.intention) || null },
  });
  refresh();
}

export async function deleteHabit(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.habit.delete({ where: { id } }).catch(() => null);
  const quests = await syncDailyQuests();
  await grantXp(quests.xpDelta);
  refresh();
}

// Lecturas que antes eran endpoints GET públicos en /api. Como Server
// Functions viajan por el mismo canal que el resto y no añaden superficie.
export async function fetchHabitMonth(
  habitId: string,
  year: number,
  monthIndex: number,
) {
  if (!habitId) return [];
  return getHabitMonth(habitId, year, monthIndex);
}

export async function fetchHabitStats(habitId: string) {
  if (!habitId) return null;
  return getHabitStats(habitId);
}

// ---------- TAREAS ----------

export type StatusChangeResult = {
  becameDone: boolean;
  xpDelta: number;
  leveledUp: boolean;
  player: PlayerSnapshot;
  questsCompleted: QuestCompletion[];
};

async function emptyStatusChange(): Promise<StatusChangeResult> {
  return {
    becameDone: false,
    xpDelta: 0,
    leveledUp: false,
    player: await playerSnapshot(),
    questsCompleted: [],
  };
}

export async function createTask(formData: FormData) {
  const title = text(formData.get("title"), LIMITS.taskTitle);
  if (!title) return;
  const description = text(formData.get("description"), LIMITS.taskDescription);
  const last = await prisma.task.findFirst({
    where: { status: "TODO" },
    orderBy: { order: "desc" },
  });
  await prisma.task.create({
    data: { title, description, status: "TODO", order: (last?.order ?? 0) + 1 },
  });
  refresh();
}

export async function updateTaskStatus(
  taskId: string,
  newStatus: TaskStatus,
): Promise<StatusChangeResult> {
  if (!taskId || !TASK_STATUSES.includes(newStatus)) {
    return emptyStatusChange();
  }
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return emptyStatusChange();

  const wasDone = task.status === "DONE";
  const willBeDone = newStatus === "DONE";
  let xpDelta = 0;
  if (!wasDone && willBeDone) xpDelta = XP_PER_TASK;
  if (wasDone && !willBeDone) xpDelta = -XP_PER_TASK;

  await prisma.task.update({
    where: { id: taskId },
    data: { status: newStatus, completedAt: willBeDone ? new Date() : null },
  });

  const quests = await syncDailyQuests();
  const { oldLevel, player } = await grantXp(xpDelta + quests.xpDelta);
  refresh();

  return {
    becameDone: !wasDone && willBeDone,
    xpDelta: xpDelta + quests.xpDelta,
    leveledUp: player.level > oldLevel,
    player,
    questsCompleted: quests.completed,
  };
}

export async function deleteTask(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.task.delete({ where: { id } }).catch(() => null);
  const quests = await syncDailyQuests();
  await grantXp(quests.xpDelta);
  refresh();
}

// ---------- PROYECTOS ----------

export async function createProject(formData: FormData) {
  const name = text(formData.get("name"), LIMITS.projectName);
  if (!name) return;
  await prisma.project.create({
    data: {
      name,
      description: text(formData.get("description"), LIMITS.projectDescription),
      icon: oneOf(formData.get("icon"), PROJECT_ICONS, "📁"),
      color: oneOf(formData.get("color"), PROJECT_COLORS, "lavender"),
    },
  });
  refresh();
}

export async function deleteProject(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.project.delete({ where: { id } }).catch(() => null);
  const quests = await syncDailyQuests();
  await grantXp(quests.xpDelta);
  refresh();
}

export async function createProjectItem(
  projectId: string,
  parentId: string | null,
  title: string,
) {
  const t = title.trim().slice(0, LIMITS.itemTitle);
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
  refresh();
}

export async function updateProjectItemStatus(
  itemId: string,
  newStatus: ProjectItemStatus,
): Promise<StatusChangeResult> {
  if (!itemId || !PROJECT_ITEM_STATUSES.includes(newStatus)) {
    return emptyStatusChange();
  }
  const item = await prisma.projectItem.findUnique({ where: { id: itemId } });
  if (!item) return emptyStatusChange();

  const wasDone = item.status === "DONE";
  const willBeDone = newStatus === "DONE";
  let xpDelta = 0;
  if (!wasDone && willBeDone) xpDelta = XP_PER_TASK;
  if (wasDone && !willBeDone) xpDelta = -XP_PER_TASK;

  await prisma.projectItem.update({
    where: { id: itemId },
    data: { status: newStatus, completedAt: willBeDone ? new Date() : null },
  });

  const quests = await syncDailyQuests();
  const { oldLevel, player } = await grantXp(xpDelta + quests.xpDelta);
  refresh();

  return {
    becameDone: !wasDone && willBeDone,
    xpDelta: xpDelta + quests.xpDelta,
    leveledUp: player.level > oldLevel,
    player,
    questsCompleted: quests.completed,
  };
}

export async function deleteProjectItem(itemId: string) {
  if (!itemId) return;
  await prisma.projectItem.delete({ where: { id: itemId } }).catch(() => null);
  const quests = await syncDailyQuests();
  await grantXp(quests.xpDelta);
  refresh();
}

export async function renameProjectItem(itemId: string, newTitle: string) {
  const t = newTitle.trim().slice(0, LIMITS.itemTitle);
  if (!itemId || !t) return;
  await prisma.projectItem.update({
    where: { id: itemId },
    data: { title: t },
  });
  refresh();
}
