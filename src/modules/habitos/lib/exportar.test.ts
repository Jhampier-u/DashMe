import { describe, it, expect } from "vitest";
import { createTestDb } from "@/modules/core/db/testing";
import * as esquema from "@/modules/core/db/schema";
import { getTableName, is } from "drizzle-orm";
import { SQLiteTable } from "drizzle-orm/sqlite-core";
import {
  ORDEN,
  FORMATO,
  VERSION,
  exportarTodo,
  importarTodo,
  contarTodo,
} from "./exportar";

const T0 = new Date(2026, 0, 15);

/** Una base con al menos una fila en cada tabla que se pueda llenar. */
async function baseConDatos() {
  const db = createTestDb();
  await db
    .insert(esquema.habits)
    .values({ id: "h1", name: "Leer", intention: "tras cenar", createdAt: T0 });
  await db.insert(esquema.habitLogs).values({
    id: "l1", habitId: "h1", date: T0, xpAwarded: 25, createdAt: T0,
  });
  await db.insert(esquema.habitNotes).values({
    id: "n1", habitId: "h1", date: T0, text: "costó", createdAt: T0, updatedAt: T0,
  });
  await db.insert(esquema.habitPauses).values({
    id: "p1", habitId: "h1", fromDay: T0, toDay: T0, createdAt: T0,
  });
  await db.insert(esquema.habitAutomaticity).values({
    id: "a1", habitId: "h1", week: T0, i1: 5, i2: 6, i3: 5, i4: 7, createdAt: T0,
  });
  await db.insert(esquema.player).values({
    id: "default", xp: 40, xpSpent: 170, shields: 2, shieldsUpdated: T0,
    createdAt: T0, updatedAt: T0,
  });
  await db.insert(esquema.dailyQuests).values({
    id: "q1", date: T0, kind: "QUEST_TASK", target: 3, progress: 1,
    xpReward: 20,
  });
  await db.insert(esquema.gardenDecorations).values({
    kind: "piedra", precio: 50, createdAt: T0,
  });
  await db
    .insert(esquema.projects)
    .values({ id: "pr1", name: "Mudanza", createdAt: T0, updatedAt: T0 });
  await db
    .insert(esquema.taskCategories)
    .values({ id: "c1", name: "Casa", color: "pink", createdAt: T0 });
  await db.insert(esquema.tasks).values({
    id: "t1", title: "Cajas", status: "DONE", order: 0,
    projectId: "pr1", categoryId: "c1", completedAt: T0,
    createdAt: T0, updatedAt: T0,
  });
  await db.insert(esquema.taskAttachments).values({
    id: "ad1", taskId: "t1", kind: "file", name: "plano.pdf",
    mime: "application/pdf", size: 10, createdAt: T0,
  });
  return db;
}

describe("el orden de importación", () => {
  it("nombra TODAS las tablas del esquema", () => {
    // Esta es la guarda que mantiene honesta la exportación: si mañana alguien
    // añade una tabla y no la pone aquí, este test cae. Sin él, una tabla
    // nueva se quedaría fuera del export en silencio, que es exactamente el
    // fallo que la propuesta 5.3 le reprocha al resto del sector.
    const enElEsquema = Object.values(esquema)
      .filter((v) => is(v, SQLiteTable))
      .map((t) => getTableName(t))
      .sort();
    expect([...ORDEN].sort()).toEqual(enElEsquema);
  });
});

describe("exportarTodo", () => {
  it("se lleva todas las filas de todas las tablas", async () => {
    const datos = await exportarTodo(await baseConDatos());
    expect(datos.formato).toBe(FORMATO);
    expect(datos.version).toBe(VERSION);
    for (const tabla of ORDEN) {
      expect(datos.tablas[tabla], `${tabla} vacía`).toHaveLength(1);
    }
  });

  it("dice cuántas filas lleva de cada tabla", async () => {
    const datos = await exportarTodo(await baseConDatos());
    expect(datos.recuento.habits).toBe(1);
    expect(Object.keys(datos.recuento).sort()).toEqual([...ORDEN].sort());
  });

  it("una base vacía se exporta vacía, no falla", async () => {
    const datos = await exportarTodo(createTestDb());
    expect(Object.values(datos.tablas).every((f) => f.length === 0)).toBe(true);
  });
});

describe("ida y vuelta", () => {
  it("lo que sale vuelve a entrar idéntico", async () => {
    // La prueba de verdad de que el export es completo: si se dejara un campo,
    // la segunda exportación no coincidiría con la primera.
    const ida = await exportarTodo(await baseConDatos());
    const destino = createTestDb();
    await importarTodo(destino, ida);
    const vuelta = await exportarTodo(destino);
    expect(vuelta.tablas).toEqual(ida.tablas);
  });

  it("conserva las fechas como fechas y no como texto", async () => {
    const ida = await exportarTodo(await baseConDatos());
    const destino = createTestDb();
    await importarTodo(destino, ida);
    const [h] = await destino.select().from(esquema.habits);
    expect(h.createdAt).toBeInstanceOf(Date);
    expect(h.createdAt.getTime()).toBe(T0.getTime());
    expect(h.intention).toBe("tras cenar");
  });

  it("deja las foráneas sanas", async () => {
    const ida = await exportarTodo(await baseConDatos());
    const destino = createTestDb();
    await importarTodo(destino, ida);
    const [t] = await destino.select().from(esquema.tasks);
    expect(t.projectId).toBe("pr1");
    expect(t.categoryId).toBe("c1");
  });
});

describe("importarTodo protege lo que ya hay", () => {
  it("se niega a escribir sobre una base con datos", async () => {
    const ida = await exportarTodo(await baseConDatos());
    await expect(importarTodo(await baseConDatos(), ida)).rejects.toThrow(
      /no está vacía/,
    );
  });

  it("con reemplazar sí, y no quedan restos de lo viejo", async () => {
    const ida = await exportarTodo(await baseConDatos());
    const destino = await baseConDatos();
    await destino
      .insert(esquema.habits)
      .values({ id: "sobra", name: "Otro", createdAt: T0 });

    await importarTodo(destino, ida, { reemplazar: true });

    const habitos = await destino.select().from(esquema.habits);
    expect(habitos).toHaveLength(1);
    expect(habitos[0].id).toBe("h1");
  });

  it("rechaza un fichero que no es del formato", async () => {
    await expect(
      importarTodo(createTestDb(), {
        formato: "otra-cosa",
        version: 1,
        generado: "",
        recuento: {},
        tablas: {},
      } as never),
    ).rejects.toThrow(/formato/);
  });

  it("rechaza una versión que no sabe leer", async () => {
    const ida = await exportarTodo(await baseConDatos());
    await expect(
      importarTodo(createTestDb(), { ...ida, version: VERSION + 1 }),
    ).rejects.toThrow(/versión/i);
  });
});

describe("contarTodo", () => {
  it("da los mismos números que el volcado, sin traer las filas", async () => {
    const db = await baseConDatos();
    expect(await contarTodo(db)).toEqual((await exportarTodo(db)).recuento);
  });
});

describe("cruzando el fichero de verdad", () => {
  /*
    El test de ida y vuelta de arriba pasaba el objeto EN MEMORIA, así que las
    fechas seguían siendo `Date` y nunca se probó lo único que importa.
    Descargando el fichero de verdad salió que JSON.stringify las convierte en
    texto y que la importación reventaba con «value.getTime is not a function».

    Estos tres cruzan `JSON.parse(JSON.stringify(...))`, que es lo que pasa
    cuando alguien pulsa Descargar.
  */
  const porFichero = <T>(x: T): T => JSON.parse(JSON.stringify(x));

  it("las fechas salen como números, no como texto", async () => {
    const datos = porFichero(await exportarTodo(await baseConDatos()));
    expect(typeof datos.tablas.habits[0].createdAt).toBe("number");
    expect(datos.tablas.habits[0].createdAt).toBe(T0.getTime());
  });

  it("y vuelven a entrar como fechas", async () => {
    const enFichero = porFichero(await exportarTodo(await baseConDatos()));
    const destino = createTestDb();
    await importarTodo(destino, enFichero);
    const [h] = await destino.select().from(esquema.habits);
    expect(h.createdAt).toBeInstanceOf(Date);
    expect(h.createdAt.getTime()).toBe(T0.getTime());
  });

  it("el volcado del fichero reimportado es idéntico al primero", async () => {
    const primero = porFichero(await exportarTodo(await baseConDatos()));
    const destino = createTestDb();
    await importarTodo(destino, primero);
    const segundo = porFichero(await exportarTodo(destino));
    expect(segundo.tablas).toEqual(primero.tablas);
  });

  it("lee también los volcados viejos, con la fecha en texto ISO", async () => {
    const viejo = porFichero(await exportarTodo(await baseConDatos()));
    viejo.tablas.habits[0].createdAt = new Date(T0).toISOString();
    const destino = createTestDb();
    await importarTodo(destino, viejo);
    const [h] = await destino.select().from(esquema.habits);
    expect(h.createdAt.getTime()).toBe(T0.getTime());
  });

  it("una fecha ilegible se rechaza en vez de guardarse como basura", async () => {
    const roto = porFichero(await exportarTodo(await baseConDatos()));
    roto.tablas.habits[0].createdAt = "ayer por la tarde";
    await expect(importarTodo(createTestDb(), roto)).rejects.toThrow(
      /Fecha ilegible/,
    );
  });
});
