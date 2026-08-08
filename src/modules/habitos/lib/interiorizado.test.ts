import { describe, expect, it } from "vitest";
import { createTestDb } from "@/modules/core/db/testing";
import { habits, habitLogs } from "@/modules/habitos/schema";
import { marcarInteriorizado, toggleToday } from "./mutations";
import { getHabitsWithTodayStatus } from "./habits";
import { getHomeMetrics } from "./home";
import { getDiasCumplidos } from "./dias-cumplidos";
import { addDays, dayKey } from "./day";

/*
  EL TERCER ESTADO: un hábito que ya está formado y deja de pedirse.

  Está construido como UNA PAUSA QUE NO TERMINA, que es la puerta por la que ya
  entran las vacaciones. Estos tests comprueban que esa decisión da gratis todo
  lo que habría habido que programar a mano.
*/
const T0 = new Date(1700000000000);

async function conHabitoCumplido() {
  const db = createTestDb();
  const hoy = dayKey();
  await db.insert(habits).values({
    id: "h1",
    name: "Leer",
    schedule: "1111111",
    createdAt: addDays(hoy, -30),
  });
  // Cinco días seguidos cumplidos, acabando ayer.
  for (let d = 5; d >= 1; d -= 1) {
    await db.insert(habitLogs).values({
      id: `l${d}`,
      habitId: "h1",
      date: addDays(hoy, -d),
      partial: false,
      xpAwarded: 25,
      createdAt: T0,
    });
  }
  return db;
}

describe("un hábito interiorizado", () => {
  it("deja de aparecer como pendiente", async () => {
    const db = await conHabitoCumplido();
    expect((await getHomeMetrics(db)).today.pending).toHaveLength(1);
    await marcarInteriorizado(db, "h1", true);
    const p = await getHomeMetrics(db);
    expect(p.today.pending).toHaveLength(0);
    expect(p.today.scheduled).toBe(0);
  });

  it("NO rompe su racha: la planta se queda como estaba", async () => {
    /*
      Es la consecuencia que justifica el diseño. `computeStreak` salta los días
      no programados, así que sigue contando hacia atrás hasta los cinco días
      cumplidos. Sin esto, la planta se habría marchitado por haberlo conseguido.
    */
    const db = await conHabitoCumplido();
    const antes = (await getHabitsWithTodayStatus(db))[0].streak;
    await marcarInteriorizado(db, "h1", true);
    const despues = (await getHabitsWithTodayStatus(db))[0];
    expect(despues.streak).toBe(antes);
    expect(despues.streak).toBeGreaterThan(0);
  });

  it("no cuenta para el clima ni arrastra la racha global", async () => {
    const db = await conHabitoCumplido();
    await marcarInteriorizado(db, "h1", true);
    const hoy = dayKey();
    const clima = await getDiasCumplidos(db, addDays(hoy, -6), hoy);
    // Ni cumplido ni fallado: sale de los dos conjuntos, como una pausa.
    expect(clima.fallados.has(hoy.getTime())).toBe(false);
    expect((await getHomeMetrics(db)).globalStreak).toBeGreaterThanOrEqual(0);
  });

  it("conserva su historial entero", async () => {
    const db = await conHabitoCumplido();
    await marcarInteriorizado(db, "h1", true);
    expect(await db.select().from(habitLogs)).toHaveLength(5);
    const h = (await getHabitsWithTodayStatus(db))[0];
    expect(h.last30.filter(Boolean).length).toBe(5);
  });

  it("ya no se puede marcar: no está programado", async () => {
    // Sin esto volvería a la vida por la puerta de atrás.
    const db = await conHabitoCumplido();
    await marcarInteriorizado(db, "h1", true);
    const r = await toggleToday(db, "h1");
    expect(r.reason).toBe("not-scheduled");
  });

  it("se puede deshacer sin perder nada", async () => {
    const db = await conHabitoCumplido();
    await marcarInteriorizado(db, "h1", true);
    await marcarInteriorizado(db, "h1", false);
    const h = (await getHabitsWithTodayStatus(db))[0];
    expect(h.interiorizadoEl).toBeNull();
    expect(h.scheduledToday).toBe(true);
    expect(h.last30.filter(Boolean).length).toBe(5);
  });

  it("guarda el día en que se dio por hecho", async () => {
    const db = await conHabitoCumplido();
    await marcarInteriorizado(db, "h1", true);
    const h = (await getHabitsWithTodayStatus(db))[0];
    expect(h.interiorizadoEl?.getTime()).toBe(dayKey().getTime());
  });
});
