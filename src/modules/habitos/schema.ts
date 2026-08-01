import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/*
  Traducción de los 7 modelos que este dominio tenía en Prisma.

  Dos desviaciones respecto al estilo de `legacy/voidtify/src/db/schema.ts`,
  ambas sin efecto en el almacenamiento físico:
    · `mode: "timestamp_ms"` — el código de este módulo trabaja con objetos Date
      en todas partes. En disco sigue siendo un INTEGER epoch en milisegundos.
    · `mode: "boolean"`      — el código espera true/false. En disco, 0/1.
*/

export const habits = sqliteTable("habits", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  icon: text("icon").notNull().default("star"),
  color: text("color").notNull().default("aqua"),
  /** flower | tree | mushroom | cactus | herb */
  plantSpecies: text("plant_species").notNull().default("flower"),
  minimalGoal: text("minimal_goal"),
  isAnchor: integer("is_anchor", { mode: "boolean" }).notNull().default(false),
  /** 7 caracteres dom→sáb, 1 = activo, 0 = se salta. */
  schedule: text("schedule").notNull().default("1111111"),
  /** "Cuando X entonces Y" */
  intention: text("intention"),
  /** Objetivo numérico del día. Nulo = este hábito no se cuenta. */
  targetCount: integer("target_count"),
  /** Su hueco en el jardín. Nulo = aún sin sitio. */
  gardenSlot: integer("garden_slot"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export type HabitRow = typeof habits.$inferSelect;

export const habitLogs = sqliteTable(
  "habit_logs",
  {
    id: text("id").primaryKey(),
    habitId: text("habit_id")
      .notNull()
      .references(() => habits.id, { onDelete: "cascade" }),
    date: integer("date", { mode: "timestamp_ms" }).notNull(),
    partial: integer("partial", { mode: "boolean" }).notNull().default(false),
    shielded: integer("shielded", { mode: "boolean" }).notNull().default(false),
    /**
     * XP concedido al crear este registro (base + ancla + hito). Al borrarlo se
     * devuelve exactamente esto, así marcar/desmarcar siempre suma cero.
     */
    xpAwarded: integer("xp_awarded").notNull().default(0),
    /** Lo apuntado ese día. Nulo = no se apuntó cantidad. */
    count: integer("count"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => ({
    // Impide registrar dos veces el mismo hábito el mismo día. De esto depende
    // el cálculo de rachas: si se pierde, la lógica se corrompe en silencio.
    unqHabitDate: uniqueIndex("habit_logs_habit_date_unq").on(t.habitId, t.date),
    byDate: index("habit_logs_date_idx").on(t.date),
  }),
);

export type HabitLogRow = typeof habitLogs.$inferSelect;

/** Tabla de una sola fila con id fijo "default". Se revisita con la auth. */
export const player = sqliteTable("player", {
  id: text("id").primaryKey(),
  xp: integer("xp").notNull().default(0),
  shields: integer("shields").notNull().default(2),
  shieldsUpdated: integer("shields_updated", {
    mode: "timestamp_ms",
  }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export type PlayerRow = typeof player.$inferSelect;

export const dailyQuests = sqliteTable(
  "daily_quests",
  {
    id: text("id").primaryKey(),
    /** Inicio del día en UTC. */
    date: integer("date", { mode: "timestamp_ms" }).notNull(),
    /** QUEST_3_HABITS | QUEST_EARLY | QUEST_TASK | QUEST_PERFECT | QUEST_TREE */
    kind: text("kind").notNull(),
    target: integer("target").notNull().default(1),
    progress: integer("progress").notNull().default(0),
    xpReward: integer("xp_reward").notNull().default(50),
    completed: integer("completed", { mode: "boolean" })
      .notNull()
      .default(false),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  },
  (t) => ({
    unqDateKind: uniqueIndex("daily_quests_date_kind_unq").on(t.date, t.kind),
    byDate: index("daily_quests_date_idx").on(t.date),
  }),
);

export type DailyQuestRow = typeof dailyQuests.$inferSelect;

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon").notNull().default("📁"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export type ProjectRow = typeof projects.$inferSelect;

export const taskCategories = sqliteTable("task_categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  /** Clave de la paleta categórica —`pink`, `lav`…—, no un hexadecimal. */
  color: text("color").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export type TaskCategoryRow = typeof taskCategories.$inferSelect;

/**
 * Notas por hábito y día.
 *
 * Tabla aparte y NO una columna de `habit_logs` a propósito: si fuera una
 * columna, escribir una nota en un día que no cumpliste obligaría a crear el
 * registro de ese día, o sea a marcar el hábito como hecho para poder decir que
 * no lo hiciste. Y ese es justo el día en que más quieres escribir algo.
 */
export const habitNotes = sqliteTable(
  "habit_notes",
  {
    id: text("id").primaryKey(),
    habitId: text("habit_id")
      .notNull()
      .references(() => habits.id, { onDelete: "cascade" }),
    date: integer("date", { mode: "timestamp_ms" }).notNull(),
    text: text("text").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => ({
    unqHabitDate: uniqueIndex("habit_notes_habit_date_unq").on(t.habitId, t.date),
  }),
);

export type HabitNoteRow = typeof habitNotes.$inferSelect;

/**
 * Pausas de un hábito: rangos de días que no cuentan para nada.
 *
 * Una pausa no es un estado nuevo, es otra razón para que un día no esté
 * programado — ver `lib/calendario.ts`.
 */
export const habitPauses = sqliteTable(
  "habit_pauses",
  {
    id: text("id").primaryKey(),
    habitId: text("habit_id")
      .notNull()
      .references(() => habits.id, { onDelete: "cascade" }),
    /** Clave de día, **inclusive**. */
    fromDay: integer("from_day", { mode: "timestamp_ms" }).notNull(),
    /** Clave de día, **inclusive**. */
    toDay: integer("to_day", { mode: "timestamp_ms" }).notNull(),
    reason: text("reason"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => ({ byHabit: index("habit_pauses_habit_idx").on(t.habitId) }),
);

export type HabitPauseRow = typeof habitPauses.$inferSelect;

/**
 * La única tabla de tareas del dashboard.
 *
 * Absorbió a `project_items`, que guardaba casi lo mismo y no se conocían. Una
 * tarea es una tarea tenga proyecto o no; `/proyectos` es esta misma tabla
 * filtrada por `project_id`.
 */
export const tasks = sqliteTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    /** TODO | IN_PROGRESS | DONE */
    status: text("status").notNull().default("TODO"),
    order: integer("order").notNull().default(0),
    /**
     * Autorreferencial: el árbol de subtareas. La clave foránea se declara en
     * SCHEMA_SQL y no aquí, porque una referencia a la propia tabla dentro del
     * objeto de columnas provoca una inicialización circular. Es el mismo
     * motivo por el que lo hacía así `project_items`, de quien hereda el árbol.
     */
    parentId: text("parent_id"),
    projectId: text("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    categoryId: text("category_id").references(() => taskCategories.id, {
      onDelete: "set null",
    }),
    /** URGENT | HIGH | MEDIUM | LOW, o nada. Se resuelve en `lib/prioridad.ts`. */
    priority: text("priority"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  },
  (t) => ({
    byParent: index("tasks_parent_idx").on(t.parentId),
    byProject: index("tasks_project_idx").on(t.projectId),
    byCategory: index("tasks_category_idx").on(t.categoryId),
  }),
);

export type TaskRow = typeof tasks.$inferSelect;

/**
 * Archivos y enlaces de una tarea, en una sola tabla.
 *
 * Una y no dos porque se leen, se ordenan y se borran juntos: en la pantalla
 * son una sola lista. Separarlos duplicaría cada consulta para ganar unas
 * columnas nulas.
 */
export const taskAttachments = sqliteTable(
  "task_attachments",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    /** 'file' | 'link' */
    kind: text("kind").notNull(),
    /** Lo que se muestra. En un archivo, el nombre con el que lo subiste. */
    name: text("name").notNull(),
    /** Solo los enlaces. */
    url: text("url"),
    /** Solo los archivos: su nombre EN DISCO, que es un UUID sin extensión. */
    storedAs: text("stored_as"),
    size: integer("size"),
    mime: text("mime"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => ({ byTask: index("task_attachments_task_idx").on(t.taskId) }),
);

export type TaskAttachmentRow = typeof taskAttachments.$inferSelect;
