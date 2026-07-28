import { describe, it, expect } from "vitest";
import { createTestDb } from "./testing";
import { habits } from "@/modules/habitos/schema";

describe("createTestDb", () => {
  it("crea las tablas y permite insertar y leer", async () => {
    const db = createTestDb();
    const now = new Date("2026-07-27T12:00:00Z");

    await db.insert(habits).values({
      id: "h1",
      name: "Leer 30 minutos",
      createdAt: now,
    });

    const rows = await db.select().from(habits);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Leer 30 minutos");
    // Los valores por defecto del esquema se aplican.
    expect(rows[0].icon).toBe("star");
    expect(rows[0].schedule).toBe("1111111");
    // mode: "boolean" devuelve un booleano, no 0/1.
    expect(rows[0].isAnchor).toBe(false);
    // mode: "timestamp_ms" devuelve un Date, no un número.
    expect(rows[0].createdAt).toBeInstanceOf(Date);
    expect(rows[0].createdAt.getTime()).toBe(now.getTime());
  });

  it("aísla cada instancia", async () => {
    const a = createTestDb();
    const b = createTestDb();
    await a
      .insert(habits)
      .values({ id: "x", name: "solo en A", createdAt: new Date() });

    expect(await a.select().from(habits)).toHaveLength(1);
    expect(await b.select().from(habits)).toHaveLength(0);
  });
});
