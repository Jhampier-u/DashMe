import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "@/modules/core/db/testing";
import { dailyQuests, habits, habitLogs } from "@/modules/habitos/schema";
import { dayKey } from "./day";
import { syncDailyQuests, getTodayQuests, pickQuestsForDate } from "./quests";

const AHORA = new Date();
const DIA = dayKey(AHORA);

describe("syncDailyQuests", () => {
  it("crea las tres misiones del día", async () => {
    const db = createTestDb();

    await syncDailyQuests(db, AHORA);

    const filas = await db.select().from(dailyQuests);
    expect(filas).toHaveLength(3);
    expect(filas.every((f) => f.date.getTime() === DIA.getTime())).toBe(true);
  });

  it("es idempotente: llamarla dos veces no duplica", async () => {
    const db = createTestDb();
    await syncDailyQuests(db, AHORA);
    const primera = (await db.select().from(dailyQuests)).length;

    await syncDailyQuests(db, AHORA);

    expect(await db.select().from(dailyQuests)).toHaveLength(primera);
  });

  it("no machaca una fila que ya existe", async () => {
    const db = createTestDb();
    const kind = pickQuestsForDate(DIA, 3)[0];
    // Fila preexistente con un premio distinto del que define QUEST_DEFS.
    await db.insert(dailyQuests).values({
      id: "preexistente",
      date: DIA,
      kind,
      target: 99,
      xpReward: 777,
    });

    await syncDailyQuests(db, AHORA);

    const [fila] = await db
      .select()
      .from(dailyQuests)
      .where(eq(dailyQuests.id, "preexistente"));
    // Si el upsert fuese onConflictDoUpdate, esto sería el valor por defecto.
    expect(fila.xpReward).toBe(777);
    expect(fila.target).toBe(99);
  });

  it("no paga dos veces la misma misión", async () => {
    const db = createTestDb();
    await db
      .insert(habits)
      .values({ id: "h1", name: "Leer", createdAt: AHORA });
    await db.insert(habitLogs).values({
      id: "l1",
      habitId: "h1",
      date: DIA,
      createdAt: AHORA,
    });

    await syncDailyQuests(db, AHORA);
    const segunda = await syncDailyQuests(db, AHORA);

    // Nada cambió entre las dos llamadas: la segunda no mueve XP.
    expect(segunda.xpDelta).toBe(0);
    expect(segunda.completed).toEqual([]);
  });

  it("no revienta con la base vacía", async () => {
    const r = await syncDailyQuests(createTestDb(), AHORA);

    expect(r.xpDelta).toBe(0);
    expect(r.completed).toEqual([]);
  });
});

describe("getTodayQuests", () => {
  it("devuelve solo las del día pedido", async () => {
    const db = createTestDb();
    const ayer = new Date(AHORA.getTime() - 24 * 60 * 60 * 1000);
    await syncDailyQuests(db, ayer);
    await syncDailyQuests(db, AHORA);

    const hoy = await getTodayQuests(db, AHORA);

    expect(hoy).toHaveLength(3);
    const idsDeHoy = new Set(hoy.map((q) => q.id));
    const filasDeHoy = await db
      .select()
      .from(dailyQuests)
      .where(eq(dailyQuests.date, DIA));
    expect(filasDeHoy.every((f) => idsDeHoy.has(f.id))).toBe(true);
  });

  it("nunca reporta progreso por encima del objetivo", async () => {
    const db = createTestDb();

    const quests = await getTodayQuests(db, AHORA);

    expect(quests.every((q) => q.progress <= q.target)).toBe(true);
  });
});
