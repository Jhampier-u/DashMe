import { describe, it, expect } from "vitest";
import { createTestDb } from "@/modules/core/db/testing";
import { projects, projectItems } from "@/modules/habitos/schema";
import {
  listProjects,
  getProjectWithTree,
  getProjectMetrics,
  ADVANCE_WEEKS,
} from "./projects";

const T0 = new Date("2026-07-01T12:00:00Z");

type Db = ReturnType<typeof createTestDb>;

function item(
  id: string,
  parentId: string | null,
  status = "TODO",
  order = 0,
  completedAt: Date | null = null,
) {
  return {
    id,
    projectId: "p1",
    parentId,
    title: `item ${id}`,
    status,
    order,
    createdAt: T0,
    updatedAt: T0,
    completedAt,
  };
}

async function seedArbol(db: Db) {
  await db
    .insert(projects)
    .values({ id: "p1", name: "Proyecto", createdAt: T0, updatedAt: T0 });
  await db.insert(projectItems).values([
    item("raiz", null),
    item("hijo", "raiz", "DONE", 0, T0),
    item("nieto", "hijo", "DONE", 0, T0),
  ]);
}

describe("getProjectWithTree", () => {
  it("anida los hijos bajo su padre", async () => {
    const db = createTestDb();
    await seedArbol(db);

    const r = (await getProjectWithTree(db, "p1"))!;

    expect(r.roots).toHaveLength(1);
    expect(r.roots[0].id).toBe("raiz");
    expect(r.roots[0].children[0].id).toBe("hijo");
    expect(r.roots[0].children[0].children[0].id).toBe("nieto");
  });

  it("cuenta los descendientes de forma recursiva", async () => {
    const db = createTestDb();
    await seedArbol(db);

    const r = (await getProjectWithTree(db, "p1"))!;

    // Tres subtareas en total, dos completadas — contando en profundidad.
    expect(r.totalItems).toBe(3);
    expect(r.doneItems).toBe(2);
  });

  it("ordena los hermanos por order y luego por fecha", async () => {
    const db = createTestDb();
    await db
      .insert(projects)
      .values({ id: "p1", name: "P", createdAt: T0, updatedAt: T0 });
    await db
      .insert(projectItems)
      .values([item("b", null, "TODO", 1), item("a", null, "TODO", 0)]);

    const r = (await getProjectWithTree(db, "p1"))!;

    expect(r.roots.map((n) => n.id)).toEqual(["a", "b"]);
  });

  it("devuelve null si el proyecto no existe", async () => {
    expect(await getProjectWithTree(createTestDb(), "no-existe")).toBeNull();
  });

  it("un proyecto sin subtareas cuenta desde su creación", async () => {
    const db = createTestDb();
    await db
      .insert(projects)
      .values({ id: "p1", name: "Vacío", createdAt: T0, updatedAt: T0 });

    const r = (await getProjectWithTree(db, "p1"))!;

    expect(r.roots).toEqual([]);
    expect(r.totalItems).toBe(0);
    expect(r.lastMovement.from).toBe("creation");
  });
});

describe("listProjects", () => {
  it("resume cada proyecto con su recuento de subtareas", async () => {
    const db = createTestDb();
    await seedArbol(db);

    const [p] = await listProjects(db);

    expect(p.id).toBe("p1");
    expect(p.totalItems).toBe(3);
    expect(p.doneItems).toBe(2);
    expect(p.lastMovement.from).toBe("completion");
  });

  it("devuelve lista vacía sin proyectos", async () => {
    expect(await listProjects(createTestDb())).toEqual([]);
  });
});

describe("getProjectMetrics", () => {
  it("no revienta con la base vacía", async () => {
    const m = await getProjectMetrics(createTestDb());

    expect(m.weeks).toHaveLength(ADVANCE_WEEKS);
  });

  it("solo cuenta las completadas con fecha", async () => {
    const db = createTestDb();
    await db
      .insert(projects)
      .values({ id: "p1", name: "P", createdAt: T0, updatedAt: T0 });
    await db.insert(projectItems).values([
      // DONE sin completedAt: no puede entrar en ningún bucket semanal.
      item("sin-fecha", null, "DONE", 0, null),
      item("abierta", null, "TODO", 1, null),
    ]);

    const m = await getProjectMetrics(db);

    expect(m.weeks.reduce((s, w) => s + w.count, 0)).toBe(0);
  });
});
