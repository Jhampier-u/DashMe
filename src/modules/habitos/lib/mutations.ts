import { and, desc, eq, gt, gte, inArray, isNull, lt, sql } from "drizzle-orm";
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
} from "./day";
import {
  DEFAULT_HABIT_COLOR,
  HABIT_COLORS,
  type HabitColor,
} from "./color";
import {
  computeStreak,
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
import { planCascada } from "./cascada";
import { diasQueCuentan } from "./cantidad";
import { cal, estaProgramado, type Rango } from "./calendario";
import { pausasDeHabito } from "./pausas";
import { borrarDeDisco, storedNamesOfTasks } from "./adjuntos";
import { resolvePrioridad } from "./prioridad";
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
  const calendario = cal(
    sanitizeSchedule(habit.schedule),
    await pausasDeHabito(db, habit.id),
  );
  const gap = previousScheduledDay(calendario, today, 14);
  if (!gap) return false;
  const before = previousScheduledDay(calendario, gap, 14);
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
  reason: "ok" | "not-found" | "not-scheduled" | "out-of-range" | "no-target";
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
  const calendario = cal(schedule, await pausasDeHabito(db, habitId));
  if (!estaProgramado(calendario, key)) {
    return emptyToggle(db, "not-scheduled");
  }

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
    const streak = await currentStreakOf(
      db,
      habitId,
      schedule,
      today,
      habit.targetCount,
    );
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

/**
 * La racha viva de un hábito.
 *
 * Trae `partial` y `count` además de la fecha, y recibe el objetivo: con un
 * objetivo, un día corto NO cuenta. Traer solo la fecha —como hacía antes— no
 * daría error con la cantidad: contaría días que no debe, y en silencio.
 */
async function currentStreakOf(
  db: Db,
  habitId: string,
  schedule: string,
  today: Date,
  targetCount: number | null,
): Promise<number> {
  const logs = await db
    .select({
      date: habitLogs.date,
      partial: habitLogs.partial,
      count: habitLogs.count,
    })
    .from(habitLogs)
    .where(
      and(
        eq(habitLogs.habitId, habitId),
        gte(habitLogs.date, addDays(today, -400)),
      ),
    );
  const keys = diasQueCuentan(
    logs.map((l) => ({ date: l.date, partial: !!l.partial, count: l.count })),
    targetCount,
  );
  // Las pausas se consultan aquí y no se reciben: esta función la llaman los
  // hitos, y pasarlas por la cadena obligaría a tocar tres firmas más para
  // ahorrar una consulta que solo corre al marcar.
  const pausas: Rango[] = await pausasDeHabito(db, habitId);
  return computeStreak(cal(schedule, pausas), keys, today);
}

/**
 * El día ya estaba registrado y solo se movió el número: ni XP, ni escudo, ni
 * hito.
 *
 * Pasar por `toggleHabitDay` aquí sería peor que inútil. Desmarcar y volver a
 * marcar puede GASTAR UN ESCUDO o disparar un aviso de hito que el usuario no ha
 * vuelto a ganar, y todo para dejar el XP donde ya estaba.
 */
async function soloContador(db: Db, partial: boolean): Promise<ToggleResult> {
  return {
    ok: true,
    reason: "ok",
    done: true,
    partial,
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
 * Apunta la cantidad de hoy en un hábito de cantidad.
 *
 * Reusa `toggleHabitDay` en lo que puede —el XP, el ancla, los hitos y los
 * escudos ya están resueltos ahí— y solo añade la columna `count` y el `partial`
 * derivado. Escribir una segunda ruta de XP en paralelo sería la forma más
 * rápida de que las dos dejaran de cuadrar.
 *
 * Cantidad 0 es desmarcar.
 */
export async function setHabitCount(
  db: Db,
  habitId: string,
  count: number,
): Promise<ToggleResult> {
  const [habit] = await db
    .select()
    .from(habitsTable)
    .where(eq(habitsTable.id, habitId))
    .limit(1);
  if (!habit) return emptyToggle(db, "not-found");
  // Sin objetivo no se apunta cantidad: ese hábito va por su botón de siempre.
  if (habit.targetCount === null) return emptyToggle(db, "no-target");

  const n = Math.max(0, Math.floor(count));
  const hoy = dayKey();
  const [existente] = await db
    .select()
    .from(habitLogs)
    .where(and(eq(habitLogs.habitId, habitId), eq(habitLogs.date, hoy)))
    .limit(1);

  if (n === 0) {
    if (!existente) return emptyToggle(db, "ok");
    // Desmarcar es exactamente lo que hace `toggleHabitDay` sobre un día ya
    // registrado: devuelve el XP que concedió y borra la fila.
    return toggleHabitDay(db, habitId, hoy, false);
  }

  const partialAhora = n < habit.targetCount;

  // Mismo tramo: solo el número. El XP ya está bien y volver a pasar por
  // `toggleHabitDay` lo movería sin motivo.
  if (existente && !!existente.partial === partialAhora) {
    await db
      .update(habitLogs)
      .set({ count: n })
      .where(eq(habitLogs.id, existente.id));
    return soloContador(db, partialAhora);
  }

  // Cambia de tramo: se pasa por la ruta de siempre, que ajusta el XP.
  if (existente) await toggleHabitDay(db, habitId, hoy, false);
  const r = await toggleHabitDay(db, habitId, hoy, partialAhora);
  await db
    .update(habitLogs)
    .set({ count: n })
    .where(and(eq(habitLogs.habitId, habitId), eq(habitLogs.date, hoy)));
  return r;
}

export async function updateHabitTarget(
  db: Db,
  habitId: string,
  targetCount: number | null,
) {
  if (!habitId) return;
  await db
    .update(habitsTable)
    .set({ targetCount })
    .where(eq(habitsTable.id, habitId));
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
  /*
    Vacío significa «este hábito no se cuenta», que es lo que son casi todos. Se
    fuerza a un entero de al menos 1: un objetivo de 0 sería un hábito imposible
    de dejar sin completar, y uno decimal no se puede ir sumando de uno en uno.
  */
  const objetivoBruto = String(formData.get("targetCount") ?? "").trim();
  const targetCount =
    objetivoBruto === "" ? null : Math.max(1, Math.floor(Number(objetivoBruto) || 1));
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
    targetCount,
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
  /** Cuántas tareas movió en total, contando la cascada. */
  cambiadas: number;
  xpDelta: number;
  leveledUp: boolean;
  player: PlayerSnapshot;
  questsCompleted: QuestCompletion[];
};

async function emptyStatusChange(db: Db): Promise<StatusChangeResult> {
  return {
    becameDone: false,
    cambiadas: 0,
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
  const priority = resolvePrioridad(
    String(formData.get("priority") ?? "") || null,
  );
  /*
    `categoryId` no se valida contra la tabla. En la base nueva la foránea lo
    rechaza sola, y en la que se puso al día quedaría apuntando a nada, que se
    lee como «sin categoría» al pintar. Comprobarlo aquí costaría una consulta
    en cada creación para un caso que solo ocurre manipulando la petición.
  */
  const categoryId = text(formData.get("categoryId"), 60);
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
    priority,
    categoryId,
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

  const filas = await db
    .select({ id: tasks.id, parentId: tasks.parentId, status: tasks.status })
    .from(tasks);

  const plan = planCascada(
    filas.map((f) => ({
      id: f.id,
      parentId: f.parentId,
      status: (f.status as TaskStatus) ?? "TODO",
    })),
    { id: taskId, nuevo: newStatus },
  );
  if (plan.length === 0) return emptyStatusChange(db);

  const ahora = new Date();
  /*
    Una transacción SÍNCRONA. En better-sqlite3, `db.transaction(cb)` de Drizzle
    devuelve `T` y no `Promise<T>`: dentro va la forma síncrona `.run()`, no
    `await`. Un `async` aquí compila y no espera a nada.

    Los cambios se agrupan por estado destino, así que son como mucho tres
    sentencias. O se escriben las tres o ninguna: un árbol a medio cerrar sería
    peor que no haber tocado nada.
  */
  db.transaction((tx) => {
    for (const destino of TASK_STATUSES) {
      const ids = plan.filter((c) => c.a === destino).map((c) => c.id);
      if (ids.length === 0) continue;
      tx.update(tasks)
        .set({
          status: destino,
          completedAt: destino === "DONE" ? ahora : null,
          updatedAt: ahora,
        })
        .where(inArray(tasks.id, ids))
        .run();
    }
  });

  // El XP sale del CONJUNTO de cambios, no de la tarea que se tocó: así cerrar
  // de arriba abajo y de abajo arriba premian igual.
  const entran = plan.filter((c) => c.a === "DONE").length;
  const salen = plan.filter((c) => c.de === "DONE").length;
  const xpDelta = (entran - salen) * XP_PER_TASK;

  const quests = await syncDailyQuests(db);
  const { oldLevel, player } = await grantXp(db, xpDelta + quests.xpDelta);

  const tocada = plan.find((c) => c.id === taskId);

  return {
    // Sigue hablando de la tarea que TOCASTE: de eso dependen el sonido y el
    // aviso, y anunciar el cierre de un padre que se movió solo confundiría.
    becameDone: tocada?.de !== "DONE" && tocada?.a === "DONE",
    cambiadas: plan.length,
    xpDelta: xpDelta + quests.xpDelta,
    leveledUp: player.level > oldLevel,
    player,
    questsCompleted: quests.completed,
  };
}

/**
 * Borra una tarea y TODO lo que cuelga de ella.
 *
 * El descenso se hace aquí y no se deja en manos del `ON DELETE CASCADE` del
 * esquema. En una base creada de cero la foránea existe y bastaría, pero en la
 * del usuario NO: sus columnas se añadieron con `ALTER TABLE`, y SQLite no
 * admite añadir una columna con referencia. Ahí el motor no vigila nada.
 *
 * Y no es un detalle cosmético. `getTasksGrouped` se salta toda tarea que tenga
 * padre, porque las subtareas no son tarjetas del tablero. Un hijo que se
 * quedara con un `parent_id` apuntando a un padre borrado no saldría en el
 * tablero NI debajo de nadie: desaparecería de la vista sin que nadie lo
 * hubiera borrado.
 */
export async function deleteTaskById(db: Db, id: string, base?: string) {
  if (!id) return;

  // Se baja por niveles en memoria en vez de con un CTE recursivo: son cuatro
  // líneas, no depende del dialecto y se puede leer de un vistazo.
  const todas = await db
    .select({ id: tasks.id, parentId: tasks.parentId })
    .from(tasks);
  const aBorrar = new Set([id]);
  let creció = true;
  while (creció) {
    creció = false;
    for (const t of todas) {
      if (t.parentId && aBorrar.has(t.parentId) && !aBorrar.has(t.id)) {
        aBorrar.add(t.id);
        creció = true;
      }
    }
  }

  const ids = [...aBorrar];

  /*
    TRES pasos y no dos, y el orden importa:

    1. LEER los nombres en disco. La foránea de `task_attachments` es en cascada,
       así que en cuanto se borren las tareas estas filas se van con ellas — y
       con ellas el único sitio donde estaba escrito cómo se llama cada archivo.
       Quien borre primero y pregunte después deja huérfanos para siempre.
    2. Borrar las tareas. Sus adjuntos caen por la cascada.
    3. Borrar los archivos. Si esto falla, lo peor es un huérfano en la carpeta,
       que no rompe nada. Al revés quedarían filas enseñando adjuntos roídos.
  */
  const enDisco = await storedNamesOfTasks(db, ids);

  await db.delete(tasks).where(inArray(tasks.id, ids));

  for (const nombre of enDisco) await borrarDeDisco(nombre, base);

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

/**
 * Borra el proyecto y suelta sus tareas, que SOBREVIVEN.
 *
 * Antes de unificar, borrar un proyecto se llevaba por delante sus elementos.
 * Ya no: una tarea es una cosa de primera clase y borrar el contenedor no debe
 * borrar el trabajo.
 *
 * El `projectId = null` se hace explícito y no se confía al `ON DELETE SET
 * NULL` del esquema, por la misma razón que en `deleteTaskById`: en la base del
 * usuario esa foránea no existe. Sin esto, sus tareas se quedarían apuntando a
 * un proyecto fantasma —fuera de `/proyectos` y diciendo pertenecer a algo que
 * ya no está—.
 */
export async function deleteProject(db: Db, formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db
    .update(tasks)
    .set({ projectId: null, updatedAt: new Date() })
    .where(eq(tasks.projectId, id));
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

/**
 * Crea una subtarea colgando de otra.
 *
 * HEREDA el proyecto del padre: una subtarea pertenece al mismo proyecto que su
 * madre, o a ninguno. Es lo que permite que el mismo árbol sirva en `/tareas` y
 * en `/proyectos` sin que el componente sepa qué es un proyecto.
 */
export async function createSubtask(db: Db, parentId: string, title: string) {
  const t = title.trim().slice(0, LIMITS.taskTitle);
  if (!parentId || !t) return;

  const [padre] = await db
    .select({ projectId: tasks.projectId })
    .from(tasks)
    .where(eq(tasks.id, parentId))
    .limit(1);
  if (!padre) return;

  const [last] = await db
    .select({ order: tasks.order })
    .from(tasks)
    .where(eq(tasks.parentId, parentId))
    .orderBy(desc(tasks.order))
    .limit(1);

  const ahora = new Date();
  await db.insert(tasks).values({
    id: crypto.randomUUID(),
    parentId,
    projectId: padre.projectId,
    title: t,
    order: (last?.order ?? 0) + 1,
    status: "TODO",
    createdAt: ahora,
    updatedAt: ahora,
  });
}

export async function updateTaskDescription(
  db: Db,
  taskId: string,
  description: string,
) {
  if (!taskId) return;
  await db
    .update(tasks)
    .set({
      description: text(description, LIMITS.taskDescription),
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId));
}

export async function updateTaskCategory(
  db: Db,
  taskId: string,
  categoryId: string | null,
) {
  if (!taskId) return;
  await db
    .update(tasks)
    .set({ categoryId, updatedAt: new Date() })
    .where(eq(tasks.id, taskId));
}

export async function updateTaskPriority(
  db: Db,
  taskId: string,
  priority: string | null,
) {
  if (!taskId) return;
  await db
    .update(tasks)
    .set({ priority: resolvePrioridad(priority), updatedAt: new Date() })
    .where(eq(tasks.id, taskId));
}

export async function renameTask(db: Db, taskId: string, newTitle: string) {
  const t = newTitle.trim().slice(0, LIMITS.taskTitle);
  if (!taskId || !t) return;
  await db
    .update(tasks)
    .set({ title: t, updatedAt: new Date() })
    .where(eq(tasks.id, taskId));
}
