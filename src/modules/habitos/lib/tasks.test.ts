import { describe, it, expect } from "vitest";
import { createTestDb } from "@/modules/core/db/testing";
import { tasks } from "@/modules/habitos/schema";
import { getTasksGrouped, getTaskMetrics, FLOW_WEEKS } from "./tasks";

const T0 = new Date("2026-07-01T12:00:00Z");

type Seed = {
  id: string;
  status?: string;
  order?: number;
  createdAt?: Date;
  completedAt?: Date | null;
};

function makeTask({
  id,
  status = "TODO",
  order = 0,
  createdAt = T0,
  completedAt = null,
}: Seed) {
  return {
    id,
    title: `tarea ${id}`,
    status,
    order,
    createdAt,
    updatedAt: createdAt,
    completedAt,
  };
}

describe("getTasksGrouped", () => {
  it("reparte por estado en las tres columnas", async () => {
    const db = createTestDb();
    await db.insert(tasks).values([
      makeTask({ id: "a", status: "TODO" }),
      makeTask({ id: "b", status: "IN_PROGRESS" }),
      makeTask({ id: "c", status: "DONE" }),
    ]);

    const g = await getTasksGrouped(db);

    expect(g.TODO.map((t) => t.id)).toEqual(["a"]);
    expect(g.IN_PROGRESS.map((t) => t.id)).toEqual(["b"]);
    expect(g.DONE.map((t) => t.id)).toEqual(["c"]);
  });

  it("ordena por order y desempata por fecha de creación", async () => {
    const db = createTestDb();
    await db.insert(tasks).values([
      makeTask({ id: "tarde", order: 1, createdAt: new Date("2026-07-02") }),
      makeTask({ id: "primera", order: 0, createdAt: new Date("2026-07-03") }),
      makeTask({ id: "empate", order: 1, createdAt: new Date("2026-07-01") }),
    ]);

    const g = await getTasksGrouped(db);

    // order asc primero; con order igual, la más antigua va antes.
    expect(g.TODO.map((t) => t.id)).toEqual(["primera", "empate", "tarde"]);
  });

  it("devuelve las tres claves aunque no haya tareas", async () => {
    const g = await getTasksGrouped(createTestDb());

    expect(g.TODO).toEqual([]);
    expect(g.IN_PROGRESS).toEqual([]);
    expect(g.DONE).toEqual([]);
  });
});

describe("getTaskMetrics", () => {
  it("no revienta con la base vacía", async () => {
    const m = await getTaskMetrics(createTestDb());

    expect(m.weeks).toHaveLength(FLOW_WEEKS);
    expect(m.medianLifetime).toBeNull();
    expect(m.oldestOpen).toBeNull();
  });

  it("cuenta como cerrada solo la que tiene completedAt", async () => {
    const db = createTestDb();
    await db.insert(tasks).values([
      // DONE pero sin completedAt: no debe entrar en el cálculo de vida.
      makeTask({ id: "sin-fecha", status: "DONE", completedAt: null }),
      makeTask({
        id: "cerrada",
        status: "DONE",
        createdAt: new Date("2026-07-01T00:00:00Z"),
        completedAt: new Date("2026-07-05T00:00:00Z"),
      }),
    ]);

    const m = await getTaskMetrics(db);

    // Una sola cerrada, de 4 días de vida: la mediana es 4.
    expect(m.medianLifetime).toBe(4);
  });

  it("considera abierta cualquiera que no esté en DONE", async () => {
    const db = createTestDb();
    await db.insert(tasks).values([
      makeTask({ id: "abierta", status: "TODO", createdAt: T0 }),
      makeTask({ id: "curso", status: "IN_PROGRESS", createdAt: T0 }),
      makeTask({ id: "cerrada", status: "DONE", completedAt: T0 }),
    ]);

    const m = await getTaskMetrics(db);

    // Hay abiertas, así que oldestOpen tiene valor (no null).
    expect(m.oldestOpen).not.toBeNull();
  });
});
