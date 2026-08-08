import { describe, expect, it } from "vitest";
import { createTestDb } from "@/modules/core/db/testing";
import { habits, habitLogs } from "@/modules/habitos/schema";
import { getHomeMetrics } from "./home";
import { getHabitsWithTodayStatus } from "./habits";
import { getDiasCumplidos } from "./dias-cumplidos";
import { addDays, dayKey } from "./day";

/*
  UN SOLO «DÍA CUMPLIDO», EN TODAS LAS PANTALLAS.

  Estos tests nacen de dos fallos medidos en la auditoría del 7 de agosto de 2026.
  `targetCount` se respetaba en unos caminos y se ignoraba en otros, así que con
  un objetivo de 8 y 2 vasos apuntados el dashboard decía tres cosas a la vez:

      racha global (portada) = 3   ← «tres días cumpliendo TODO lo programado»
      racha del hábito       = 0
      días cumplidos (clima) = 3   → cielo despejado

  Y dentro del mismo objeto, `doneToday` era `true` mientras `last30[0]` era
  `false`.

  Lo que se prueba aquí no es una función: es que TRES CONSULTAS DISTINTAS
  coinciden. Por eso no vive en el archivo de ninguna de ellas.
*/

const T0 = new Date(1700000000000);

async function conObjetivo(objetivo: number | null) {
  const db = createTestDb();
  await db.insert(habits).values({
    id: "h1",
    name: "Tomar 8 vasos de agua",
    schedule: "1111111",
    targetCount: objetivo,
    createdAt: addDays(dayKey(), -30),
  });
  return db;
}

async function apuntar(
  db: Awaited<ReturnType<typeof conObjetivo>>,
  haceDias: number,
  count: number | null,
  partial = false,
) {
  await db.insert(habitLogs).values({
    id: `l${haceDias}`,
    habitId: "h1",
    date: addDays(dayKey(), -haceDias),
    partial,
    count,
    createdAt: T0,
  });
}

describe("un día corto no cuenta en NINGUNA pantalla", () => {
  it("ni en la racha del hábito, ni en la global, ni en el clima", async () => {
    const db = await conObjetivo(8);
    for (const d of [2, 1, 0]) await apuntar(db, d, 2);

    const portada = await getHomeMetrics(db);
    const [habito] = await getHabitsWithTodayStatus(db);
    const clima = await getDiasCumplidos(db, addDays(dayKey(), -6), dayKey());

    expect(habito.streak).toBe(0);
    expect(portada.globalStreak).toBe(0);
    expect(clima.cumplidos.size).toBe(0);
  });

  it("y sigue apareciendo como pendiente en la portada", async () => {
    // Quitarlo de pendientes con 2 de 8 era el efecto más engañoso: la única
    // pantalla que te dice qué te queda por hacer, te lo ocultaba.
    const db = await conObjetivo(8);
    await apuntar(db, 0, 2);
    const portada = await getHomeMetrics(db);
    expect(portada.today.done).toBe(0);
    expect(portada.today.pending.map((p) => p.name)).toEqual([
      "Tomar 8 vasos de agua",
    ]);
  });
});

describe("un día que llega al objetivo cuenta en todas", () => {
  it("racha, racha global y clima coinciden", async () => {
    const db = await conObjetivo(8);
    for (const d of [2, 1, 0]) await apuntar(db, d, 8);

    const portada = await getHomeMetrics(db);
    const [habito] = await getHabitsWithTodayStatus(db);
    const clima = await getDiasCumplidos(db, addDays(dayKey(), -6), dayKey());

    expect(habito.streak).toBe(3);
    expect(portada.globalStreak).toBe(3);
    expect(clima.cumplidos.size).toBe(3);
    expect(portada.today.done).toBe(1);
    expect(portada.today.pending).toHaveLength(0);
  });
});

describe("sin objetivo, nada cambia respecto a antes", () => {
  it("cualquier registro cuenta, como siempre", async () => {
    // Es la garantía de que este arreglo no toca los hábitos que ya existen.
    const db = await conObjetivo(null);
    for (const d of [2, 1, 0]) await apuntar(db, d, null);

    const portada = await getHomeMetrics(db);
    const [habito] = await getHabitsWithTodayStatus(db);
    const clima = await getDiasCumplidos(db, addDays(dayKey(), -6), dayKey());

    expect(habito.streak).toBe(3);
    expect(portada.globalStreak).toBe(3);
    expect(clima.cumplidos.size).toBe(3);
  });
});

describe("`doneToday` y `last30` no pueden contradecirse", () => {
  it("porque ahora salen del mismo conjunto", async () => {
    const db = await conObjetivo(8);
    await apuntar(db, 0, 2);
    const [corto] = await getHabitsWithTodayStatus(db);
    expect(corto.doneToday).toBe(false);
    expect(corto.last30[0]).toBe(false);

    const db2 = await conObjetivo(8);
    await apuntar(db2, 0, 8);
    const [pleno] = await getHabitsWithTodayStatus(db2);
    expect(pleno.doneToday).toBe(true);
    expect(pleno.last30[0]).toBe(true);
  });

  it("`registradoHoy` sí distingue «hay registro» de «está completo»", async () => {
    /*
      Las dos preguntas son distintas y hacen falta las dos. El botón de marcar
      BORRA el registro que exista, así que mira `registradoHoy`: si mirara
      `doneToday`, pulsar sobre un 2 de 8 borraría esos 2 sin avisar.
    */
    const db = await conObjetivo(8);
    await apuntar(db, 0, 2);
    const [h] = await getHabitsWithTodayStatus(db);
    expect(h.doneToday).toBe(false);
    expect(h.registradoHoy).toBe(true);
    expect(h.countToday).toBe(2);
  });

  it("sin registro, las dos son falsas", async () => {
    const db = await conObjetivo(8);
    const [h] = await getHabitsWithTodayStatus(db);
    expect(h.doneToday).toBe(false);
    expect(h.registradoHoy).toBe(false);
  });
});
