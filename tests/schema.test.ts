import { describe, expect, it } from "vitest";
import { createTestDb } from "./helpers/test-db";

function tablas(sqlite: ReturnType<typeof createTestDb>["sqlite"]): string[] {
  const filas = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all() as { name: string }[];
  return filas.map((f) => f.name);
}

/*
  Este fichero probaba las tablas de música. El módulo salió del dashboard el 8
  de agosto de 2026 y el fichero se reapuntó a lo que queda en vez de borrarse:
  su trabajo de verdad es vigilar que `createTestDb()` levanta el esquema
  COMPLETO, y ese trabajo sigue haciendo falta.

  Lo que NO comprueba: que las tablas de música hayan desaparecido de la base
  del usuario. No han desaparecido, y es a propósito — sus filas siguen ahí,
  solo que este esquema ya no las crea en una base nueva.
*/
const TABLAS = [
  "habits",
  "habit_logs",
  "habit_notes",
  "habit_pauses",
  "player",
  "daily_quests",
  "projects",
  "task_categories",
  "tasks",
  "task_attachments",
  "garden_decorations",
];

describe("esquema", () => {
  it("crea todas las tablas del dashboard", () => {
    const { sqlite } = createTestDb();
    const nombres = tablas(sqlite);
    for (const t of TABLAS) expect(nombres).toContain(t);
  });

  it("no arrastra tablas del módulo de música", () => {
    const { sqlite } = createTestDb();
    const nombres = tablas(sqlite);
    for (const t of ["streams", "spotify_credentials", "artists", "tags"]) {
      expect(nombres).not.toContain(t);
    }
  });

  it("trata «Casa» y «casa» como la misma categoría", () => {
    const { sqlite } = createTestDb();
    const insertar = sqlite.prepare(
      "INSERT INTO task_categories (id, name, color, created_at) VALUES (?, ?, ?, ?)",
    );
    insertar.run("a", "Casa", "acid", Date.now());

    // NOCASE en el índice único. El código comprueba lo mismo antes de
    // insertar para dar un mensaje, pero la base es quien lo garantiza.
    expect(() => insertar.run("b", "casa", "acid", Date.now())).toThrow(
      /UNIQUE/,
    );
  });

  it("se lleva las subtareas al borrar la tarea padre", () => {
    const { sqlite } = createTestDb();
    sqlite.pragma("foreign_keys = ON");
    const insertar = sqlite.prepare(
      "INSERT INTO tasks (id, title, status, created_at, updated_at, parent_id)" +
        " VALUES (?, ?, ?, ?, ?, ?)",
    );
    const ahora = Date.now();
    insertar.run("padre", "Mudanza", "TODO", ahora, ahora, null);
    insertar.run("hija", "Cajas", "TODO", ahora, ahora, "padre");

    sqlite.prepare("DELETE FROM tasks WHERE id = ?").run("padre");

    // CASCADE, no SET NULL: una subtarea sin padre no significa nada.
    const quedan = sqlite
      .prepare("SELECT count(*) c FROM tasks")
      .get() as { c: number };
    expect(quedan.c).toBe(0);
  });
});
