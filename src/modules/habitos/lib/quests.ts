import { and, asc, count, eq, gte, isNotNull, isNull, lt } from "drizzle-orm";
import type { Db } from "@/modules/core/db";
import {
  dailyQuests,
  habits as habitsTable,
  habitLogs,
  tasks,
} from "@/modules/habitos/schema";
import { dayKey, localDayRange } from "./day";
import { cal, estaProgramado } from "./calendario";
import { pausasPorHabito } from "./pausas";
import { esCompleto } from "./cantidad";

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
    label: "Tres hábitos",
    description: "Completa 3 hábitos hoy",
    emoji: "🎯",
    target: 3,
    xpReward: 50,
  },
  QUEST_EARLY: {
    kind: "QUEST_EARLY",
    label: "Antes de las 10",
    description: "Marca 1 hábito antes de las 10:00",
    emoji: "🌅",
    target: 1,
    xpReward: 30,
  },
  QUEST_TASK: {
    kind: "QUEST_TASK",
    label: "Dos tareas",
    description: "Completa 2 tareas",
    emoji: "📝",
    target: 2,
    xpReward: 40,
  },
  QUEST_TREE: {
    kind: "QUEST_TREE",
    label: "Una subtarea",
    description: "Completa 1 subtarea de proyecto",
    emoji: "🌳",
    target: 1,
    xpReward: 30,
  },
  QUEST_PERFECT: {
    kind: "QUEST_PERFECT",
    label: "Día completo",
    description: "Cumple todos tus hábitos de hoy",
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
async function computeProgress(
  db: Db,
  now: Date,
): Promise<Record<QuestKind, number>> {
  const today = dayKey(now);
  const { start, end } = localDayRange(now);
  const earlyCutoff = new Date(start.getTime());
  earlyCutoff.setHours(EARLY_QUEST_HOUR, 0, 0, 0);

  const [todayLogs, habits, tasksDoneRows, itemsDoneRows] = await Promise.all([
    db
      .select({
        habitId: habitLogs.habitId,
        partial: habitLogs.partial,
        count: habitLogs.count,
        createdAt: habitLogs.createdAt,
      })
      .from(habitLogs)
      .where(and(eq(habitLogs.date, today), eq(habitLogs.shielded, false))),
    db
      .select({
        id: habitsTable.id,
        schedule: habitsTable.schedule,
        targetCount: habitsTable.targetCount,
      })
      .from(habitsTable),
    /*
      Dos misiones distintas, no una: «Dos tareas» y «Una subtarea de proyecto».
      Antes las separaba la tabla; ahora las separa `project_id`, y el conjunto
      que cuenta cada una es exactamente el mismo de antes, fila por fila:
      ninguna tarea tenía proyecto y todo elemento de proyecto lo tenía.
    */
    db
      .select({ n: count() })
      .from(tasks)
      .where(
        and(
          eq(tasks.status, "DONE"),
          isNull(tasks.projectId),
          gte(tasks.completedAt, start),
          lt(tasks.completedAt, end),
        ),
      ),
    db
      .select({ n: count() })
      .from(tasks)
      .where(
        and(
          eq(tasks.status, "DONE"),
          isNotNull(tasks.projectId),
          gte(tasks.completedAt, start),
          lt(tasks.completedAt, end),
        ),
      ),
  ]);

  const tasksDone = tasksDoneRows[0]?.n ?? 0;
  const itemsDone = itemsDoneRows[0]?.n ?? 0;

  /*
    Un hábito en pausa NO cuenta para el día perfecto, y eso es correcto: no lo
    has fallado. Si contara, una pausa haría imposible la misión.
  */
  const pausas = await pausasPorHabito(db);
  const scheduledToday = habits.filter((h) =>
    estaProgramado(cal(h.schedule, pausas.get(h.id) ?? []), today),
  );
  /*
    `esCompleto` y no `!partial`: con un objetivo, apuntar 2 de 8 no es un día
    cumplido, y antes esta misión lo daba por bueno mientras la racha del mismo
    hábito no se movía.
  */
  const objetivoPorHabito = new Map(habits.map((h) => [h.id, h.targetCount]));
  const fullyDone = new Set(
    todayLogs
      .filter((l) =>
        esCompleto(
          objetivoPorHabito.get(l.habitId) ?? null,
          l.count,
          !!l.partial,
        ),
      )
      .map((l) => l.habitId),
  );
  const perfect =
    scheduledToday.length > 0 &&
    scheduledToday.every((h) => fullyDone.has(h.id));

  const early = todayLogs.some(
    (l) => l.createdAt.getTime() < earlyCutoff.getTime(),
  );

  return {
    QUEST_3_HABITS: todayLogs.length,
    QUEST_EARLY: early ? 1 : 0,
    QUEST_TASK: tasksDone,
    QUEST_TREE: itemsDone,
    QUEST_PERFECT: perfect ? 1 : 0,
  };
}

async function ensureRows(db: Db, today: Date) {
  const kinds = pickQuestsForDate(today, 3);
  for (const kind of kinds) {
    const def = QUEST_DEFS[kind];
    // onConflictDoNothing, no DoUpdate: resincronizar no debe tocar lo que ya
    // existe. Con DoUpdate se resetearían target y xpReward de una misión ya
    // en curso, y el jugador vería cambiar el premio a mitad del día.
    await db
      .insert(dailyQuests)
      .values({
        id: crypto.randomUUID(),
        date: today,
        kind,
        target: def.target,
        xpReward: def.xpReward,
      })
      .onConflictDoNothing({
        target: [dailyQuests.date, dailyQuests.kind],
      });
  }
  return db
    .select()
    .from(dailyQuests)
    .where(eq(dailyQuests.date, today))
    .orderBy(asc(dailyQuests.kind));
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
  db: Db,
  now: Date = new Date(),
): Promise<QuestSyncResult> {
  const today = dayKey(now);
  const [rows, progress] = await Promise.all([
    ensureRows(db, today),
    computeProgress(db, now),
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
      // Update con guardia sobre `completed`: si dos acciones corren a la vez,
      // solo una encuentra la fila sin completar y solo una paga.
      const pagadas = await db
        .update(dailyQuests)
        .set({ progress: value, completed: true, completedAt: now })
        .where(
          and(eq(dailyQuests.id, row.id), eq(dailyQuests.completed, false)),
        )
        .returning({ id: dailyQuests.id });
      if (pagadas.length === 1) {
        xpDelta += row.xpReward;
        completed.push({
          kind,
          label: def.label,
          xp: row.xpReward,
          emoji: def.emoji,
        });
      }
    } else if (!reached && row.completed) {
      const devueltas = await db
        .update(dailyQuests)
        .set({ progress: value, completed: false, completedAt: null })
        .where(and(eq(dailyQuests.id, row.id), eq(dailyQuests.completed, true)))
        .returning({ id: dailyQuests.id });
      if (devueltas.length === 1) xpDelta -= row.xpReward;
    } else if (row.progress !== value) {
      await db
        .update(dailyQuests)
        .set({ progress: value })
        .where(eq(dailyQuests.id, row.id));
    }
  }

  return { xpDelta, completed };
}

/** Misiones de hoy para pintar el panel. No concede ni retira XP. */
export async function getTodayQuests(
  db: Db,
  now: Date = new Date(),
): Promise<DailyQuestRow[]> {
  const today = dayKey(now);
  const [rows, progress] = await Promise.all([
    ensureRows(db, today),
    computeProgress(db, now),
  ]);
  return rows
    .filter((r) => QUEST_DEFS[r.kind as QuestKind])
    .map((r) => ({
      id: r.id,
      kind: r.kind as QuestKind,
      target: r.target,
      progress: Math.min(r.target, progress[r.kind as QuestKind] ?? r.progress),
      xpReward: r.xpReward,
      completed: r.completed,
    }));
}
