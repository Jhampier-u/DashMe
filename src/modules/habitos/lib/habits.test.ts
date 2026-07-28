import { describe, it, expect } from "vitest";
import { createTestDb } from "@/modules/core/db/testing";
import { habits, habitLogs, player } from "@/modules/habitos/schema";
import { MAX_SHIELDS, SHIELD_REGEN_DAYS } from "./level";
import { MS_PER_DAY } from "./day";
import {
  getHabitsWithTodayStatus,
  getOrCreatePlayer,
  getHabitMonth,
} from "./habits";

const T0 = new Date("2020-01-01T00:00:00Z");

type Db = ReturnType<typeof createTestDb>;

async function seedDosHabitos(db: Db) {
  await db.insert(habits).values([
    { id: "h1", name: "Leer", isAnchor: false, createdAt: T0 },
    { id: "h2", name: "Agua", isAnchor: true, createdAt: T0 },
  ]);
}

describe("getHabitsWithTodayStatus", () => {
  it("pone el hábito ancla primero", async () => {
    const db = createTestDb();
    await seedDosHabitos(db);

    const rows = await getHabitsWithTodayStatus(db);

    expect(rows.map((h) => h.id)).toEqual(["h2", "h1"]);
  });

  it("marca hasEverBeenDone aunque el único registro esté fuera de la ventana de rachas", async () => {
    const db = createTestDb();
    await seedDosHabitos(db);
    // Muy anterior al corte de 400 días: fuera de la ventana que se lee para
    // calcular rachas, pero el hábito SÍ se cumplió alguna vez. Si esto se
    // calcula sobre la lista filtrada, el jardín lo dibuja como semilla.
    await db.insert(habitLogs).values({
      id: "l1",
      habitId: "h1",
      date: new Date("2020-06-01T00:00:00Z"),
      createdAt: T0,
    });

    const h1 = (await getHabitsWithTodayStatus(db)).find((h) => h.id === "h1")!;

    expect(h1.hasEverBeenDone).toBe(true);
    expect(h1.streak).toBe(0);
  });

  it("no marca hasEverBeenDone sin ningún registro", async () => {
    const db = createTestDb();
    await seedDosHabitos(db);

    const h1 = (await getHabitsWithTodayStatus(db)).find((h) => h.id === "h1")!;

    expect(h1.hasEverBeenDone).toBe(false);
    expect(h1.doneToday).toBe(false);
  });

  it("no revienta sin hábitos", async () => {
    expect(await getHabitsWithTodayStatus(createTestDb())).toEqual([]);
  });

  it("devuelve siempre 30 días en last30", async () => {
    const db = createTestDb();
    await seedDosHabitos(db);

    const h1 = (await getHabitsWithTodayStatus(db)).find((h) => h.id === "h1")!;

    expect(h1.last30).toHaveLength(30);
  });
});

describe("getOrCreatePlayer", () => {
  it("crea el jugador por defecto la primera vez", async () => {
    const db = createTestDb();

    const p = await getOrCreatePlayer(db);

    expect(p.id).toBe("default");
    expect(p.xp).toBe(0);
    expect(p.shields).toBe(MAX_SHIELDS);
  });

  it("no duplica al llamarla dos veces", async () => {
    const db = createTestDb();
    await getOrCreatePlayer(db);
    await getOrCreatePlayer(db);

    expect(await db.select().from(player)).toHaveLength(1);
  });

  it("regenera un escudo cuando ha pasado el periodo", async () => {
    const db = createTestDb();
    const now = new Date();
    const hace16Dias = new Date(
      now.getTime() - (SHIELD_REGEN_DAYS + 1) * MS_PER_DAY,
    );
    await db.insert(player).values({
      id: "default",
      xp: 0,
      shields: 0,
      shieldsUpdated: hace16Dias,
      createdAt: hace16Dias,
      updatedAt: hace16Dias,
    });

    const p = await getOrCreatePlayer(db);

    expect(p.shields).toBe(1);
  });

  it("estando lleno no pasa de MAX_SHIELDS pero adelanta el reloj", async () => {
    const db = createTestDb();
    const now = new Date();
    const hace100Dias = new Date(now.getTime() - 100 * MS_PER_DAY);
    await db.insert(player).values({
      id: "default",
      xp: 0,
      shields: MAX_SHIELDS,
      shieldsUpdated: hace100Dias,
      createdAt: hace100Dias,
      updatedAt: hace100Dias,
    });

    const p = await getOrCreatePlayer(db);

    expect(p.shields).toBe(MAX_SHIELDS);
    // El reloj avanza aunque no se gane nada: si se quedara congelado, el
    // primer escudo gastado se recuperaría al instante.
    expect(p.shieldsUpdated.getTime()).toBeGreaterThan(hace100Dias.getTime());
  });
});

describe("getHabitMonth", () => {
  it("devuelve una rejilla múltiplo de 7", async () => {
    const db = createTestDb();
    await seedDosHabitos(db);

    const dias = await getHabitMonth(db, "h1", 2026, 6);

    expect(dias.length % 7).toBe(0);
    expect(dias.filter((d) => d.inMonth)).toHaveLength(31);
  });

  it("devuelve vacío si el hábito no existe", async () => {
    expect(await getHabitMonth(createTestDb(), "no-existe", 2026, 6)).toEqual(
      [],
    );
  });

  it("rechaza meses fuera de rango", async () => {
    const db = createTestDb();
    await seedDosHabitos(db);

    expect(await getHabitMonth(db, "h1", 2026, 12)).toEqual([]);
    expect(await getHabitMonth(db, "h1", 1999, 0)).toEqual([]);
  });
});
