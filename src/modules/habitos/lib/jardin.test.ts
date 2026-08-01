import { describe, expect, it } from "vitest";
import { createTestDb } from "@/modules/core/db/testing";
import { habits, habitLogs, habitPauses } from "@/modules/habitos/schema";
import { getJardinHistorico, intercambiarHuecos } from "./jardin";

const T0 = new Date(1700000000000);

/** Tres plantas creadas en orden, ninguna ancla, ninguna con hueco guardado. */
async function jardin(slots: (number | null)[] = [null, null, null]) {
  const db = createTestDb();
  for (let i = 0; i < slots.length; i += 1) {
    await db.insert(habits).values({
      id: `h${i + 1}`,
      name: `Hábito ${i + 1}`,
      createdAt: new Date(T0.getTime() + i * 1000),
      gardenSlot: slots[i],
    });
  }
  return db;
}

async function huecos(db: Awaited<ReturnType<typeof jardin>>) {
  const filas = await db
    .select({ id: habits.id, slot: habits.gardenSlot })
    .from(habits);
  return Object.fromEntries(filas.map((f) => [f.id, f.slot]));
}

describe("intercambiarHuecos", () => {
  it("intercambia el sitio de las dos plantas", async () => {
    const db = await jardin([0, 1, 2]);
    await intercambiarHuecos(db, "h1", "h3");
    expect(await huecos(db)).toEqual({ h1: 2, h2: 1, h3: 0 });
  });

  it("deja guardado el hueco de TODAS, no solo el de las dos", async () => {
    // Es el caso real del primer arrastre: nadie tiene hueco todavía porque la
    // colocación se venía calculando al pintar. Si solo guardara el par, `h2`
    // seguiría en nulo y se movería sola en cuanto cambiara el número de
    // plantas.
    const db = await jardin([null, null, null]);
    await intercambiarHuecos(db, "h1", "h2");
    const h = await huecos(db);
    expect(h).toEqual({ h1: 1, h2: 0, h3: 2 });
    expect(Object.values(h)).not.toContain(null);
  });

  it("no deja dos plantas en el mismo sitio aunque la base venga repetida", async () => {
    const db = await jardin([1, 1, 1]);
    await intercambiarHuecos(db, "h1", "h3");
    const valores = Object.values(await huecos(db));
    expect(new Set(valores).size).toBe(3);
  });

  it("ignora un id que ya no existe sin tocar nada", async () => {
    // La planta se borró en otra pestaña mientras arrastrabas esta.
    const db = await jardin([0, 1, 2]);
    await intercambiarHuecos(db, "h1", "fantasma");
    expect(await huecos(db)).toEqual({ h1: 0, h2: 1, h3: 2 });
  });

  it("intercambiar una planta consigo misma no cambia nada", async () => {
    const db = await jardin([0, 1, 2]);
    await intercambiarHuecos(db, "h2", "h2");
    expect(await huecos(db)).toEqual({ h1: 0, h2: 1, h3: 2 });
  });

  it("hacerlo dos veces devuelve el jardín a como estaba", async () => {
    const db = await jardin([0, 1, 2]);
    await intercambiarHuecos(db, "h1", "h3");
    await intercambiarHuecos(db, "h1", "h3");
    expect(await huecos(db)).toEqual({ h1: 0, h2: 1, h3: 2 });
  });

  it("el jardín queda fijo: repetir el mismo intercambio da lo mismo", async () => {
    // Esto es lo que compra guardar todos los huecos. Una vez colocado, el
    // resultado ya no depende de cuántas plantas haya ni de cuándo se crearon.
    const a = await jardin([null, null, null]);
    await intercambiarHuecos(a, "h1", "h2");
    const primera = await huecos(a);
    await intercambiarHuecos(a, "h3", "h3");
    expect(await huecos(a)).toEqual(primera);
  });
});

describe("getJardinHistorico", () => {
  const D = (n: number) => new Date(Date.UTC(2026, 6, n));

  it("trae de cada hábito lo justo para reconstruirlo", async () => {
    const db = await jardin([0]);
    await db.insert(habitLogs).values([
      { id: "l1", habitId: "h1", date: D(9), createdAt: T0 },
      { id: "l2", habitId: "h1", date: D(10), createdAt: T0 },
    ]);
    await db.insert(habitPauses).values({
      id: "p1",
      habitId: "h1",
      fromDay: D(5),
      toDay: D(6),
      createdAt: T0,
    });

    const [h] = await getJardinHistorico(db);
    expect(h.cumplidos.sort()).toEqual([D(9).getTime(), D(10).getTime()]);
    expect(h.pausas).toEqual([{ desde: D(5), hasta: D(6) }]);
    expect(h.schedule).toBe("1111111");
  });

  it("un hábito sin registros llega con la lista vacía, no ausente", async () => {
    // Si faltara, dejaría de existir en TODOS los días, incluido hoy: una
    // semilla recién plantada tiene que salir en su sitio.
    const db = await jardin([0]);
    const [h] = await getJardinHistorico(db);
    expect(h.cumplidos).toEqual([]);
    expect(h.pausas).toEqual([]);
  });

  it("normaliza la fecha del registro a clave de día", async () => {
    // Un registro guardado a media tarde tiene que caer en su día, no crear uno
    // propio a las 17:43.
    const db = await jardin([0]);
    await db.insert(habitLogs).values({
      id: "l1",
      habitId: "h1",
      date: new Date(Date.UTC(2026, 6, 9, 17, 43)),
      createdAt: T0,
    });
    const [h] = await getJardinHistorico(db);
    expect(h.cumplidos).toEqual([D(9).getTime()]);
  });
});
