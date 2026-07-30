import { describe, expect, it } from "vitest";
import { createTestDb } from "@/modules/core/db/testing";
import type { Db } from "@/modules/core/db";
import { habits, habitLogs, habitPauses } from "@/modules/habitos/schema";
import { getDiasCumplidos } from "./dias-cumplidos";

const T0 = new Date(Date.UTC(2026, 6, 1));
const D = (n: number) => new Date(Date.UTC(2026, 6, n));

async function conHabito(id: string, schedule = "1111111"): Promise<Db> {
  const db = createTestDb();
  await db.insert(habits).values({ id, name: id, schedule, createdAt: T0 });
  return db;
}

async function marcar(db: Db, habitId: string, dia: Date, partial = false) {
  await db.insert(habitLogs).values({
    id: `${habitId}-${dia.getTime()}`,
    habitId,
    date: dia,
    partial,
    xpAwarded: 0,
    createdAt: dia,
  });
}

describe("getDiasCumplidos", () => {
  it("un día con todo hecho es cumplido", async () => {
    const db = await conHabito("h1");
    await marcar(db, "h1", D(2));
    const r = await getDiasCumplidos(db, D(2), D(2));
    expect([...r.cumplidos]).toEqual([D(2).getTime()]);
    expect([...r.fallados]).toEqual([]);
  });

  it("un día con algo sin hacer es fallado", async () => {
    const db = await conHabito("h1");
    await db.insert(habits).values({
      id: "h2",
      name: "h2",
      schedule: "1111111",
      createdAt: T0,
    });
    await marcar(db, "h1", D(2));
    const r = await getDiasCumplidos(db, D(2), D(2));
    expect([...r.fallados]).toEqual([D(2).getTime()]);
    expect([...r.cumplidos]).toEqual([]);
  });

  /*
    Un día a medias NO es un día cumplido: misma definición que la racha global y
    que la misión «día completo».
  */
  it("un día a medias es fallado", async () => {
    const db = await conHabito("h1");
    await marcar(db, "h1", D(2), true);
    const r = await getDiasCumplidos(db, D(2), D(2));
    expect([...r.fallados]).toEqual([D(2).getTime()]);
  });

  /*
    UN DÍA EN PAUSA NO ES NI CUMPLIDO NI FALLADO. Si contara como fallado, una
    pausa larga sería una racha de fallos y torcería la comparación entera.
  */
  it("un día en pausa sale de los dos conjuntos", async () => {
    const db = await conHabito("h1");
    await db.insert(habitPauses).values({
      id: "p1",
      habitId: "h1",
      fromDay: D(2),
      toDay: D(2),
      reason: null,
      createdAt: T0,
    });
    const r = await getDiasCumplidos(db, D(2), D(2));
    expect(r.cumplidos.size).toBe(0);
    expect(r.fallados.size).toBe(0);
  });

  it("un día sin nada programado sale de los dos", async () => {
    // Solo lunes; el 2026-07-02 es jueves.
    const db = await conHabito("h1", "0100000");
    const r = await getDiasCumplidos(db, D(2), D(2));
    expect(r.cumplidos.size).toBe(0);
    expect(r.fallados.size).toBe(0);
  });

  /*
    Un hábito no cuenta antes de existir: si no, todos los días anteriores a su
    creación saldrían como fallados y el grupo se llenaría de basura.
  */
  it("un hábito no cuenta antes de existir", async () => {
    const db = createTestDb();
    await db.insert(habits).values({
      id: "h1",
      name: "h1",
      schedule: "1111111",
      createdAt: D(10),
    });
    const r = await getDiasCumplidos(db, D(5), D(5));
    expect(r.cumplidos.size).toBe(0);
    expect(r.fallados.size).toBe(0);
  });

  it("sin hábitos los dos conjuntos están vacíos", async () => {
    const r = await getDiasCumplidos(createTestDb(), D(1), D(10));
    expect(r.cumplidos.size).toBe(0);
    expect(r.fallados.size).toBe(0);
  });

  it("recorre el rango entero y reparte cada día", async () => {
    const db = await conHabito("h1");
    await marcar(db, "h1", D(2));
    await marcar(db, "h1", D(4));
    const r = await getDiasCumplidos(db, D(2), D(5));
    expect([...r.cumplidos].sort()).toEqual([D(2).getTime(), D(4).getTime()]);
    expect([...r.fallados].sort()).toEqual([D(3).getTime(), D(5).getTime()]);
  });
});
