import { describe, it, expect } from "vitest";
import { createTestDb } from "@/modules/core/db/testing";
import { habits, habitLogs } from "@/modules/habitos/schema";
import { dayKey } from "./day";
import { getHabitStats, getGlobalStats, HEATMAP_WEEKS } from "./stats";
import { getHomeMetrics } from "./home";

const HOY = dayKey();
const T0 = new Date("2026-07-01T12:00:00Z");

type Db = ReturnType<typeof createTestDb>;

async function seedHabito(db: Db) {
  await db.insert(habits).values({ id: "h1", name: "Leer", createdAt: T0 });
}

describe("getHabitStats", () => {
  it("devuelve ceros si el hábito no existe", async () => {
    const s = await getHabitStats(createTestDb(), "no-existe");

    expect(s.totalDone).toBe(0);
    expect(s.currentStreak).toBe(0);
    expect(s.bestStreak).toBe(0);
  });

  it("cuenta los registros del hábito", async () => {
    const db = createTestDb();
    await seedHabito(db);
    await db.insert(habitLogs).values([
      { id: "l1", habitId: "h1", date: HOY, createdAt: T0 },
      {
        id: "l2",
        habitId: "h1",
        date: new Date(HOY.getTime() - 86_400_000),
        createdAt: T0,
      },
    ]);

    const s = await getHabitStats(db, "h1");

    expect(s.totalDone).toBe(2);
    expect(s.currentStreak).toBeGreaterThanOrEqual(2);
  });

  it("no revienta con un hábito sin registros", async () => {
    const db = createTestDb();
    await seedHabito(db);

    const s = await getHabitStats(db, "h1");

    expect(s.totalDone).toBe(0);
    expect(s.completionRate30).toBe(0);
  });
});

describe("getGlobalStats", () => {
  it("no revienta con la base vacía", async () => {
    const s = await getGlobalStats(createTestDb());

    expect(s.totalCompletions).toBe(0);
    expect(s.todayCompletions).toBe(0);
    expect(s.bestWeekday).toBeNull();
    expect(s.weeks).toHaveLength(HEATMAP_WEEKS);
    expect(s.weeks[0]).toHaveLength(7);
  });

  it("agrega los registros de todos los hábitos", async () => {
    const db = createTestDb();
    await db.insert(habits).values([
      { id: "h1", name: "Leer", createdAt: T0 },
      { id: "h2", name: "Agua", createdAt: T0 },
    ]);
    await db.insert(habitLogs).values([
      { id: "l1", habitId: "h1", date: HOY, createdAt: T0 },
      { id: "l2", habitId: "h2", date: HOY, createdAt: T0 },
    ]);

    const s = await getGlobalStats(db);

    expect(s.totalCompletions).toBe(2);
    expect(s.todayCompletions).toBe(2);
    expect(s.bestWeekday).not.toBeNull();
  });

  it("cuenta en totalCompletions también lo que cae fuera del mapa", async () => {
    const db = createTestDb();
    await seedHabito(db);
    // Muy anterior a las 12 semanas del mapa de calor: no aparece en `weeks`,
    // pero sigue siendo una compleción histórica.
    await db.insert(habitLogs).values({
      id: "viejo",
      habitId: "h1",
      date: new Date("2021-01-01T00:00:00Z"),
      createdAt: T0,
    });

    const s = await getGlobalStats(db);

    expect(s.totalCompletions).toBe(1);
    expect(s.todayCompletions).toBe(0);
  });
});

describe("getHomeMetrics", () => {
  it("no revienta con la base vacía", async () => {
    const m = await getHomeMetrics(createTestDb());

    expect(m.habitCount).toBe(0);
    expect(m.today.pending).toEqual([]);
    expect(m.longestStreak).toBeNull();
  });

  it("lista como pendiente el hábito que toca hoy y no está hecho", async () => {
    const db = createTestDb();
    await seedHabito(db);

    const m = await getHomeMetrics(db);

    expect(m.habitCount).toBe(1);
    expect(m.today.pending.some((p) => p.id === "h1")).toBe(true);
    expect(m.today.done).toBe(0);
  });

  it("deja de contarlo como pendiente al cumplirlo", async () => {
    const db = createTestDb();
    await seedHabito(db);
    await db
      .insert(habitLogs)
      .values({ id: "l1", habitId: "h1", date: HOY, createdAt: T0 });

    const m = await getHomeMetrics(db);

    expect(m.today.done).toBe(1);
    expect(m.today.pending.some((p) => p.id === "h1")).toBe(false);
  });
});
