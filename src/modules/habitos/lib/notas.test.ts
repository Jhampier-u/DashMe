import { describe, expect, it } from "vitest";
import { createTestDb } from "@/modules/core/db/testing";
import { habits, habitLogs } from "@/modules/habitos/schema";
import { getNota, notasDeHabito, setNota } from "./notas";

const T0 = new Date(1700000000000);
const DIA1 = new Date(Date.UTC(2026, 6, 1));
const DIA2 = new Date(Date.UTC(2026, 6, 2));

async function conHabito() {
  const db = createTestDb();
  await db.insert(habits).values({
    id: "h1",
    name: "Leer",
    schedule: "1111111",
    createdAt: T0,
  });
  return db;
}

describe("setNota", () => {
  it("guarda y devuelve la nota", async () => {
    const db = await conHabito();
    await setNota(db, "h1", DIA1, "Hoy me costó");
    expect(await getNota(db, "h1", DIA1)).toBe("Hoy me costó");
  });

  it("volver a guardar el mismo día actualiza, no duplica", async () => {
    const db = await conHabito();
    await setNota(db, "h1", DIA1, "primera");
    await setNota(db, "h1", DIA1, "segunda");
    expect(await getNota(db, "h1", DIA1)).toBe("segunda");
    expect(await notasDeHabito(db, "h1")).toHaveLength(1);
  });

  /*
    Vacío BORRA. Así el estado «sin nota» es uno solo y no dos —fila ausente o
    fila con cadena vacía—, que es la clase de duplicidad que después se olvida
    en un `if` y pinta un punto de nota donde no hay nada.
  */
  it("guardar vacío borra la fila", async () => {
    const db = await conHabito();
    await setNota(db, "h1", DIA1, "algo");
    await setNota(db, "h1", DIA1, "   ");
    expect(await getNota(db, "h1", DIA1)).toBeNull();
    expect(await notasDeHabito(db, "h1")).toHaveLength(0);
  });

  it("borrar una que no existe no revienta", async () => {
    const db = await conHabito();
    await expect(setNota(db, "h1", DIA1, "")).resolves.not.toThrow();
  });

  /*
    ESTE ES EL MOTIVO DE QUE LAS NOTAS SEAN UNA TABLA APARTE. Se puede escribir
    una nota en un día sin registro, sin que eso marque el hábito.
  */
  it("se puede anotar un día sin marcar el hábito", async () => {
    const db = await conHabito();
    await setNota(db, "h1", DIA1, "Hoy no pude, estaba enfermo");
    expect(await db.select().from(habitLogs)).toHaveLength(0);
    expect(await getNota(db, "h1", DIA1)).toBe("Hoy no pude, estaba enfermo");
  });

  it("normaliza al día, así que dos horas del mismo día son la misma nota", async () => {
    const db = await conHabito();
    await setNota(db, "h1", DIA1, "una");
    await setNota(db, "h1", new Date(DIA1.getTime() + 3_600_000), "otra");
    expect(await notasDeHabito(db, "h1")).toHaveLength(1);
    expect(await getNota(db, "h1", DIA1)).toBe("otra");
  });
});

describe("notasDeHabito", () => {
  it("las devuelve por día", async () => {
    const db = await conHabito();
    await setNota(db, "h1", DIA1, "una");
    await setNota(db, "h1", DIA2, "dos");
    const todas = await notasDeHabito(db, "h1");
    expect(todas).toHaveLength(2);
    expect(todas.map((n) => n.text)).toContain("dos");
  });

  it("de un hábito sin notas devuelve vacío", async () => {
    expect(await notasDeHabito(await conHabito(), "h1")).toEqual([]);
  });
});
