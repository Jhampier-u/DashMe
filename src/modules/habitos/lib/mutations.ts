import { and, desc, eq, gt, gte, isNull, lt, sql } from "drizzle-orm";
import type { Db } from "@/modules/core/db";
import {
  habits as habitsTable,
  habitLogs,
  player as playerTable,
  projects,
  tasks,
} from "@/modules/habitos/schema";
import {
  BACKFILL_MAX_DAYS,
  getOrCreatePlayer,
  getHabitMonth,
} from "./habits";
import {
  addDays,
  dayKey,
  dayKeyFromISO,
  daysBetween,
  normalizeDayKey,
} from "./day";
import {
  DEFAULT_HABIT_COLOR,
  HABIT_COLORS,
  type HabitColor,
} from "./color";
import {
  computeStreak,
  isScheduledOn,
  previousScheduledDay,
  sanitizeSchedule,
} from "./streak";
import {
  ANCHOR_BONUS,
  MAX_SHIELDS,
  XP_PER_HABIT,
  XP_PER_TASK,
  getLevelInfo,
  levelFromXp,
  milestoneFor,
  type LevelInfo,
} from "./level";
import { TASK_STATUSES, type TaskStatus } from "./tasks";
import { PLANT_SPECIES, type PlantSpecies } from "./garden";
import { syncDailyQuests, type QuestCompletion } from "./quests";
import { getHabitStats } from "./stats";

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
} as const;

// Las claves salen de lib/color.ts y no de una lista propia: tener aquí una
// copia fue justo el fallo. Al pasar el selector a tres colores, esta lista se
// quedó con los cinco antiguos, así que `oneOf` rechazaba "aqua", "violet" y
// "orange" y guardaba el fallback. Elegir violeta guardaba otro color.
const HABIT_COLOR_KEYS = HABIT_COLORS.map((c) => c.key);
const PROJECT_ICONS = ["📁", "🎯", "🚀", "🎨", "🎮", "📚", "💼", "🏗️", "🌟", "🧪", "🎵", "🌱"];

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
async function grantXp(
  db: Db,
  delta: number,
): Promise<{
  oldLevel: number;
  player: PlayerSnapshot;
}> {
  const current = await getOrCreatePlayer(db);
  if (delta === 0) {
    return {
      oldLevel: levelFromXp(current.xp),
      player: { ...getLevelInfo(current.xp), shields: current.shields },
    };
  }

  // Incremento en SQL, no leer-modificar-escribir: dos clicks simultáneos ya
  // no se pisan.
  const [updated] = await db
    .update(playerTable)
    .set({
      xp: sql`${playerTable.xp} + ${delta}`,
      updatedAt: new Date(),
    })
    .where(eq(playerTable.id, "default"))
    .returning();

  let xp = updated.xp;
  if (xp < 0) {
    xp = 0;
    await db
      .update(playerTable)
      .set({ xp: 0, updatedAt: new Date() })
      .where(eq(playerTable.id, "default"));
  }

  return {
    oldLevel: levelFromXp(Math.max(0, updated.xp - delta)),
    player: { ...getLevelInfo(xp), shields: updated.shields },
  };
}

async function playerSnapshot(db: Db): Promise<PlayerSnapshot> {
  const player = await getOrCreatePlayer(db);
  return { ...getLevelInfo(player.xp), shields: player.shields };
}

// ---------- ESCUDOS ----------

async function refundShield(db: Db) {
  // La guardia `shields < MAX` va en el WHERE: nunca devuelve por encima del
  // tope, aunque dos deshacer lleguen a la vez.
  await db
    .update(playerTable)
    .set({
      shields: sql`${playerTable.shields} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(eq(playerTable.id, "default"), lt(playerTable.shields, MAX_SHIELDS)),
    );
}

/**
 * Rellena con un escudo el hueco del día programado anterior.
 *
 * Ahora respeta el calendario del hábito: si tu hábito es L-M-V y ayer era
 * martes, el hueco a cubrir es el lunes, no "ayer".
 */
async function trySpendShield(
  db: Db,
  habit: { id: string; schedule: string | null },
  today: Date,
): Promise<boolean> {
  const schedule = sanitizeSchedule(habit.schedule);
  const gap = previousScheduledDay(schedule, today, 14);
  if (!gap) return false;
  const before = previousScheduledDay(schedule, gap, 14);
  if (!before) return false;

  const [gapLog, beforeLog] = await Promise.all([
    db
      .select()
      .from(habitLogs)
      .where(and(eq(habitLogs.habitId, habit.id), eq(habitLogs.date, gap)))
      .limit(1),
    db
      .select()
      .from(habitLogs)
      .where(and(eq(habitLogs.habitId, habit.id), eq(habitLogs.date, before)))
      .limit(1),
  ]);
  if (gapLog.length) return false; // no hay hueco
  if (!beforeLog.length) return false; // no había racha que salvar

  // Guardia atómica: la condición `shields > 0` va en el WHERE, así que nunca
  // gasta un escudo que no existe.
  const gastados = await db
    .update(playerTable)
    .set({
      shields: sql`${playerTable.shields} - 1`,
      updatedAt: new Date(),
    })
    .where(and(eq(playerTable.id, "default"), gt(playerTable.shields, 0)))
    .returning({ id: playerTable.id });
  if (gastados.length !== 1) return false;

  try {
    await db.insert(habitLogs).values({
      id: crypto.randomUUID(),
      habitId: habit.id,
      date: gap,
      shielded: true,
      xpAwarded: 0,
      createdAt: new Date(),
    });
    return true;
  } catch {
    await refundShield(db);
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
  db: Db,
  reason: ToggleResult["reason"],
): Promise<ToggleResult> {
  return {
    ok: false,
    reason,
    done: false,
    partial: false,
    xpDelta: 0,
    leveledUp: false,
    player: await playerSnapshot(db),
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
export async function toggleHabitDay(
  db: Db,
  habitId: string,
  key: Date,
  partial: boolean,
): Promise<ToggleResult> {
  const [habit] = await db
    .select()
    .from(habitsTable)
    .where(eq(habitsTable.id, habitId))
    .limit(1);
  if (!habit) return emptyToggle(db, "not-found");

  const today = dayKey();
  if (key.getTime() > today.getTime()) return emptyToggle(db, "out-of-range");
  if (daysBetween(today, key) > BACKFILL_MAX_DAYS) {
    return emptyToggle(db, "out-of-range");
  }

  const schedule = sanitizeSchedule(habit.schedule);
  if (!isScheduledOn(schedule, key)) return emptyToggle(db, "not-scheduled");

  const isToday = key.getTime() === today.getTime();
  const [existing] = await db
    .select()
    .from(habitLogs)
    .where(and(eq(habitLogs.habitId, habitId), eq(habitLogs.date, key)))
    .limit(1);

  let logXpDelta = 0;
  let done = false;
  let nowPartial = false;
  let shieldUsed = false;
  let anchorTriggered = false;
  let milestone: ToggleResult["milestone"] = null;

  if (existing) {
    await db.delete(habitLogs).where(eq(habitLogs.id, existing.id));
    logXpDelta = -existing.xpAwarded;
    // Si borras un día cubierto por un escudo, se te devuelve.
    if (existing.shielded) await refundShield(db);
  } else {
    const base = partial ? Math.floor(XP_PER_HABIT / 2) : XP_PER_HABIT;
    anchorTriggered = habit.isAnchor && !partial;
    let awarded = base + (anchorTriggered ? ANCHOR_BONUS : 0);

    const [created] = await db
      .insert(habitLogs)
      .values({
        id: crypto.randomUUID(),
        habitId,
        date: key,
        partial,
        xpAwarded: awarded,
        createdAt: new Date(),
      })
      .returning();
    done = true;
    nowPartial = partial;

    // Hito: se calcula sobre la racha real (respetando el calendario) y su
    // bonus queda grabado en el propio registro para poder devolverlo.
    const streak = await currentStreakOf(db, habitId, schedule, today);
    const m = milestoneFor(streak);
    if (m) {
      awarded += m.bonus;
      await db
        .update(habitLogs)
        .set({ xpAwarded: awarded })
        .where(eq(habitLogs.id, created.id));
      milestone = { habitName: habit.name, days: m.days, bonus: m.bonus };
    }
    logXpDelta = awarded;

    if (isToday && !partial) {
      shieldUsed = await trySpendShield(db, { id: habitId, schedule }, today);
    }
  }

  const quests = await syncDailyQuests(db);
  const { oldLevel, player } = await grantXp(db, logXpDelta + quests.xpDelta);

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
  db: Db,
  habitId: string,
  schedule: string,
  today: Date,
): Promise<number> {
  const logs = await db
    .select({ date: habitLogs.date })
    .from(habitLogs)
    .where(
      and(
        eq(habitLogs.habitId, habitId),
        gte(habitLogs.date, addDays(today, -400)),
      ),
    );
  const keys = new Set(logs.map((l) => normalizeDayKey(l.date).getTime()));
  return computeStreak(schedule, keys, today);
}

export async function toggleToday(
  db: Db,
  habitId: string,
  partial = false,
): Promise<ToggleResult> {
  if (!habitId) return emptyToggle(db, "not-found");
  return toggleHabitDay(db, habitId, dayKey(), partial);
}

export async function toggleHabitOnDay(
  db: Db,
  habitId: string,
  isoDate: string,
): Promise<ToggleResult> {
  if (!habitId) return emptyToggle(db, "not-found");
  const key = dayKeyFromISO(isoDate);
  if (!key) return emptyToggle(db, "out-of-range");
  return toggleHabitDay(db, habitId, key, false);
}

export async function createHabit(db: Db, formData: FormData) {
  const name = text(formData.get("name"), LIMITS.habitName);
  if (!name) return;

  const icon = text(formData.get("icon"), LIMITS.habitIcon) ?? "⭐";
  const color = oneOf<HabitColor>(
    formData.get("color"),
    HABIT_COLOR_KEYS,
    DEFAULT_HABIT_COLOR,
  );
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
    // Solo puede haber un ancla: se desmarca la anterior.
    await db
      .update(habitsTable)
      .set({ isAnchor: false })
      .where(eq(habitsTable.isAnchor, true));
  }
  await db.insert(habitsTable).values({
    id: crypto.randomUUID(),
    name,
    icon,
    color,
    plantSpecies,
    minimalGoal,
    schedule,
    intention,
    isAnchor,
    createdAt: new Date(),
  });

  // Un hábito nuevo puede deshacer el "día perfecto" que ya estaba pagado.
  const quests = await syncDailyQuests(db);
  await grantXp(db, quests.xpDelta);
}

export async function setHabitAnchor(
  db: Db,
  habitId: string,
  makeAnchor: boolean,
) {
  if (!habitId) return;
  if (makeAnchor) {
    await db
      .update(habitsTable)
      .set({ isAnchor: false })
      .where(eq(habitsTable.isAnchor, true));
  }
  await db
    .update(habitsTable)
    .set({ isAnchor: makeAnchor })
    .where(eq(habitsTable.id, habitId));
}

export async function updateHabitSchedule(
  db: Db,
  habitId: string,
  schedule: string,
) {
  if (!habitId) return;
  await db
    .update(habitsTable)
    .set({ schedule: sanitizeSchedule(schedule) })
    .where(eq(habitsTable.id, habitId));
  const quests = await syncDailyQuests(db);
  await grantXp(db, quests.xpDelta);
}

export async function updateHabitIntention(
  db: Db,
  habitId: string,
  intention: string,
) {
  if (!habitId) return;
  await db
    .update(habitsTable)
    .set({ intention: intention.trim().slice(0, LIMITS.intention) || null })
    .where(eq(habitsTable.id, habitId));
}

export async function deleteHabit(db: Db, formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.delete(habitsTable).where(eq(habitsTable.id, id));
  const quests = await syncDailyQuests(db);
  await grantXp(db, quests.xpDelta);
}

// Lecturas que antes eran endpoints GET públicos en /api. Como Server
// Functions viajan por el mismo canal que el resto y no añaden superficie.
export async function fetchHabitMonth(
  db: Db,
  habitId: string,
  year: number,
  monthIndex: number,
) {
  if (!habitId) return [];
  return getHabitMonth(db, habitId, year, monthIndex);
}

export async function fetchHabitStats(db: Db, habitId: string) {
  if (!habitId) return null;
  return getHabitStats(db, habitId);
}

// ---------- TAREAS ----------

export type StatusChangeResult = {
  becameDone: boolean;
  xpDelta: number;
  leveledUp: boolean;
  player: PlayerSnapshot;
  questsCompleted: QuestCompletion[];
};

async function emptyStatusChange(db: Db): Promise<StatusChangeResult> {
  return {
    becameDone: false,
    xpDelta: 0,
    leveledUp: false,
    player: await playerSnapshot(db),
    questsCompleted: [],
  };
}

export async function createTask(db: Db, formData: FormData) {
  const title = text(formData.get("title"), LIMITS.taskTitle);
  if (!title) return;
  const description = text(formData.get("description"), LIMITS.taskDescription);
  // Dentro de SU grupo, no dentro de todo TODO: desde la unificación hay
  // grupos —por padre y por proyecto— y el orden solo se compara dentro de uno.
  const [last] = await db
    .select({ order: tasks.order })
    .from(tasks)
    .where(
      and(
        eq(tasks.status, "TODO"),
        isNull(tasks.parentId),
        isNull(tasks.projectId),
      ),
    )
    .orderBy(desc(tasks.order))
    .limit(1);
  const ahora = new Date();
  await db.insert(tasks).values({
    id: crypto.randomUUID(),
    title,
    description,
    status: "TODO",
    order: (last?.order ?? 0) + 1,
    createdAt: ahora,
    updatedAt: ahora,
  });
}

export async function updateTaskStatus(
  db: Db,
  taskId: string,
  newStatus: TaskStatus,
): Promise<StatusChangeResult> {
  if (!taskId || !TASK_STATUSES.includes(newStatus)) {
    return emptyStatusChange(db);
  }
  const [task] = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);
  if (!task) return emptyStatusChange(db);

  const wasDone = task.status === "DONE";
  const willBeDone = newStatus === "DONE";
  let xpDelta = 0;
  if (!wasDone && willBeDone) xpDelta = XP_PER_TASK;
  if (wasDone && !willBeDone) xpDelta = -XP_PER_TASK;

  await db
    .update(tasks)
    .set({
      status: newStatus,
      completedAt: willBeDone ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId));

  const quests = await syncDailyQuests(db);
  const { oldLevel, player } = await grantXp(db, xpDelta + quests.xpDelta);

  return {
    becameDone: !wasDone && willBeDone,
    xpDelta: xpDelta + quests.xpDelta,
    leveledUp: player.level > oldLevel,
    player,
    questsCompleted: quests.completed,
  };
}

/** Borra por id. Sus subtareas caen con ella por la foránea en cascada. */
export async function deleteTaskById(db: Db, id: string) {
  if (!id) return;
  await db.delete(tasks).where(eq(tasks.id, id));
  const quests = await syncDailyQuests(db);
  await grantXp(db, quests.xpDelta);
}

export async function deleteTask(db: Db, formData: FormData) {
  await deleteTaskById(db, String(formData.get("id") ?? ""));
}

// ---------- PROYECTOS ----------

export async function createProject(db: Db, formData: FormData) {
  const name = text(formData.get("name"), LIMITS.projectName);
  if (!name) return;
  const ahora = new Date();
  await db.insert(projects).values({
    id: crypto.randomUUID(),
    name,
    description: text(formData.get("description"), LIMITS.projectDescription),
    icon: oneOf(formData.get("icon"), PROJECT_ICONS, "📁"),
    createdAt: ahora,
    updatedAt: ahora,
  });
}

export async function deleteProject(db: Db, formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.delete(projects).where(eq(projects.id, id));
  const quests = await syncDailyQuests(db);
  await grantXp(db, quests.xpDelta);
}

export async function createProjectTask(
  db: Db,
  projectId: string,
  parentId: string | null,
  title: string,
) {
  const t = title.trim().slice(0, LIMITS.taskTitle);
  if (!projectId || !t) return;
  // `parentId` puede ser null y en SQL `= NULL` nunca casa: hay que usar
  // IS NULL. isNull/eq según el caso, no un eq a secas.
  const [last] = await db
    .select({ order: tasks.order })
    .from(tasks)
    .where(
      and(
        eq(tasks.projectId, projectId),
        parentId === null
          ? isNull(tasks.parentId)
          : eq(tasks.parentId, parentId),
      ),
    )
    .orderBy(desc(tasks.order))
    .limit(1);
  const ahora = new Date();
  await db.insert(tasks).values({
    id: crypto.randomUUID(),
    projectId,
    parentId,
    title: t,
    order: (last?.order ?? 0) + 1,
    status: "TODO",
    createdAt: ahora,
    updatedAt: ahora,
  });
}

/*
  Aquí vivía `updateProjectItemStatus`. Era byte a byte lo mismo que
  `updateTaskStatus` salvo el nombre de la tabla; ahora es la misma tabla, así
  que es la misma función. Colapsarlas es el motivo de haber unificado.
*/

export async function renameTask(db: Db, taskId: string, newTitle: string) {
  const t = newTitle.trim().slice(0, LIMITS.taskTitle);
  if (!taskId || !t) return;
  await db
    .update(tasks)
    .set({ title: t, updatedAt: new Date() })
    .where(eq(tasks.id, taskId));
}
