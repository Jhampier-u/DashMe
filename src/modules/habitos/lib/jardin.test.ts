import { describe, expect, it } from "vitest";
import { createTestDb } from "@/modules/core/db/testing";
import { habits } from "@/modules/habitos/schema";
import { intercambiarHuecos } from "./jardin";

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
