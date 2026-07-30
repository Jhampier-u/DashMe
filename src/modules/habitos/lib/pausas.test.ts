import { describe, expect, it } from "vitest";
import { createTestDb } from "@/modules/core/db/testing";
import { habits, habitLogs } from "@/modules/habitos/schema";
import {
  addPausa,
  borrarPausa,
  pausasDeHabito,
  pausasPorHabito,
} from "./pausas";

const T0 = new Date(1700000000000);
const D = (n: number) => new Date(Date.UTC(2026, 6, n));

async function conHabito(id = "h1") {
  const db = createTestDb();
  await db.insert(habits).values({
    id,
    name: "Leer",
    schedule: "1111111",
    createdAt: T0,
  });
  return db;
}

describe("addPausa", () => {
  it("la guarda y la devuelve", async () => {
    const db = await conHabito();
    await addPausa(db, "h1", D(1), D(15), "vacaciones");
    const [p] = await pausasDeHabito(db, "h1");
    expect(p.desde.getTime()).toBe(D(1).getTime());
    expect(p.hasta.getTime()).toBe(D(15).getTime());
    expect(p.reason).toBe("vacaciones");
  });

  /*
    Un rango al revés es un error de dedo, no una intención: se endereza en vez
    de rechazarse.
  */
  it("endereza un rango al revés", async () => {
    const db = await conHabito();
    await addPausa(db, "h1", D(15), D(1), null);
    const [p] = await pausasDeHabito(db, "h1");
    expect(p.desde.getTime()).toBe(D(1).getTime());
    expect(p.hasta.getTime()).toBe(D(15).getTime());
  });

  it("normaliza al día, así que una hora suelta no descoloca el rango", async () => {
    const db = await conHabito();
    await addPausa(db, "h1", new Date(D(1).getTime() + 3_600_000), D(2), null);
    const [p] = await pausasDeHabito(db, "h1");
    expect(p.desde.getTime()).toBe(D(1).getTime());
  });

  it("admite varias, incluso solapadas", async () => {
    const db = await conHabito();
    await addPausa(db, "h1", D(1), D(10), null);
    await addPausa(db, "h1", D(5), D(15), null);
    expect(await pausasDeHabito(db, "h1")).toHaveLength(2);
  });

  it("un motivo vacío se guarda como sin motivo", async () => {
    const db = await conHabito();
    await addPausa(db, "h1", D(1), D(2), "   ");
    expect((await pausasDeHabito(db, "h1"))[0].reason).toBeNull();
  });

  /*
    Un registro dentro de una pausa NO se borra. Es la única opción que no pierde
    datos, y deshacer la pausa devuelve las cosas a su sitio exactamente.
  */
  it("no borra los registros que caen dentro", async () => {
    const db = await conHabito();
    await db.insert(habitLogs).values({
      id: "l1",
      habitId: "h1",
      date: D(5),
      xpAwarded: 0,
      createdAt: T0,
    });
    await addPausa(db, "h1", D(1), D(10), null);
    expect(await db.select().from(habitLogs)).toHaveLength(1);
  });
});

describe("borrarPausa", () => {
  it("la quita", async () => {
    const db = await conHabito();
    await addPausa(db, "h1", D(1), D(5), null);
    const [p] = await pausasDeHabito(db, "h1");
    await borrarPausa(db, p.id);
    expect(await pausasDeHabito(db, "h1")).toHaveLength(0);
  });

  it("borrar una que no existe no revienta", async () => {
    const db = await conHabito();
    await expect(borrarPausa(db, "fantasma")).resolves.not.toThrow();
  });
});

describe("pausasPorHabito", () => {
  it("agrupa por hábito y no mezcla", async () => {
    const db = await conHabito("h1");
    await db.insert(habits).values({
      id: "h2",
      name: "Correr",
      schedule: "1111111",
      createdAt: T0,
    });
    await addPausa(db, "h1", D(1), D(5), null);
    await addPausa(db, "h2", D(8), D(9), null);

    const mapa = await pausasPorHabito(db);

    expect(mapa.get("h1")).toHaveLength(1);
    expect(mapa.get("h2")![0].desde.getTime()).toBe(D(8).getTime());
  });

  it("un hábito sin pausas no aparece, y eso vale como lista vacía", async () => {
    const db = await conHabito();
    expect((await pausasPorHabito(db)).get("h1") ?? []).toEqual([]);
  });
});
