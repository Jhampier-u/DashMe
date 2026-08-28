import { describe, it, expect } from "vitest";
import { createTestDb } from "@/modules/core/db/testing";
import { habits, habitAutomaticity } from "@/modules/habitos/schema";
import {
  ITEMS,
  MIN_DIAS,
  MEDIDAS_MINIMAS,
  puntuacion,
  sugerirInteriorizado,
  type Medida,
  estadoSrbai,
  guardarMedida,
} from "./srbai";

const semana = (n: number) => new Date(2026, 0, 5 + n * 7);

/** Una medida con los cuatro ítems al mismo valor: la media es ese valor. */
function m(n: number, valor: number): Medida {
  return { week: semana(n), i1: valor, i2: valor, i3: valor, i4: valor };
}

describe("la escala", () => {
  it("son los cuatro ítems del SRBAI, ni uno más", () => {
    expect(ITEMS).toHaveLength(4);
  });

  it("la puntuación es la media de los cuatro", () => {
    expect(puntuacion({ week: semana(0), i1: 1, i2: 2, i3: 3, i4: 4 })).toBe(
      2.5,
    );
    expect(puntuacion(m(0, 7))).toBe(7);
  });
});

describe("sugerirInteriorizado", () => {
  it("calla mientras el hábito es joven, aunque puntúe altísimo", () => {
    // Lally: el más rápido de su muestra tardó 18 días. Preguntar antes mide
    // entusiasmo, no automaticidad.
    const medidas = [m(0, 7), m(1, 7), m(2, 7), m(3, 7)];
    expect(sugerirInteriorizado(medidas, MIN_DIAS - 1).tipo).toBe("pronto");
  });

  it("calla con pocas medidas", () => {
    const pocas = [m(0, 7), m(1, 7)];
    expect(pocas.length).toBeLessThan(MEDIDAS_MINIMAS);
    expect(sugerirInteriorizado(pocas, 200).tipo).toBe("faltan-medidas");
  });

  it("no sugiere si la curva sigue subiendo", () => {
    // Aún está creciendo: sugerir aquí sería adelantarse a la meseta.
    const subiendo = [m(0, 2), m(1, 3.5), m(2, 5), m(3, 6.5)];
    expect(sugerirInteriorizado(subiendo, 200).tipo).toBe("creciendo");
  });

  it("no sugiere una meseta baja", () => {
    // Plana pero abajo: eso no es un hábito, es un hábito que no cuaja.
    const plana = [m(0, 2), m(1, 2), m(2, 2.25), m(3, 2)];
    expect(sugerirInteriorizado(plana, 200).tipo).toBe("meseta-baja");
  });

  it("no sugiere en la rodilla de la curva", () => {
    // Sube fuerte y luego se dobla, pero las tres últimas aún recorren 1,5
    // puntos. Eso es la rodilla, no la meseta: sugerir aquí se adelantaría
    // justo a lo que hay que esperar.
    const rodilla = [m(0, 3), m(1, 5), m(2, 6.25), m(3, 6.5)];
    expect(sugerirInteriorizado(rodilla, 200).tipo).toBe("creciendo");
  });

  it("sugiere cuando la curva se aplana arriba", () => {
    const asintotica = [m(0, 3), m(1, 5), m(2, 6.25), m(3, 6.5), m(4, 6.5)];
    const r = sugerirInteriorizado(asintotica, 200);
    expect(r.tipo).toBe("sugerir");
    if (r.tipo === "sugerir") {
      expect(r.media).toBeCloseTo(6.42, 1);
      expect(r.semanas).toBe(5);
    }
  });

  it("una recaída retira la sugerencia", () => {
    // La meseta se mide sobre las ÚLTIMAS medidas, no sobre el mejor momento.
    const recaida = [m(0, 6), m(1, 6.5), m(2, 6.5), m(3, 3)];
    expect(sugerirInteriorizado(recaida, 200).tipo).not.toBe("sugerir");
  });

  it("mira las últimas, no todas", () => {
    // Un arranque malo hace mucho tiempo no debe impedir la sugerencia.
    const largo = [m(0, 1), m(1, 1), m(2, 4), m(3, 6), m(4, 6.5), m(5, 6.5)];
    expect(sugerirInteriorizado(largo, 300).tipo).toBe("sugerir");
  });

  it("sin medidas no revienta", () => {
    expect(sugerirInteriorizado([], 300).tipo).toBe("faltan-medidas");
  });
});

describe("contra la base", () => {
  it("una medida por semana: contestar dos veces corrige, no acumula", async () => {
    const db = createTestDb();
    const nacimiento = new Date(2026, 0, 1);
    await db.insert(habits).values({
      id: "h1",
      name: "Leer",
      createdAt: nacimiento,
    });
    const hoy = new Date(2026, 2, 4); // miércoles, >18 días después

    await guardarMedida(db, "h1", [7, 7, 7, 7], hoy);
    await guardarMedida(db, "h1", [2, 2, 2, 2], hoy);

    const filas = await db.select().from(habitAutomaticity);
    expect(filas).toHaveLength(1);
    expect(filas[0].i1).toBe(2);
  });

  it("rechaza una respuesta fuera de la escala", async () => {
    const db = createTestDb();
    await db
      .insert(habits)
      .values({ id: "h1", name: "Leer", createdAt: new Date(2026, 0, 1) });
    await expect(
      guardarMedida(db, "h1", [1, 2, 3, 8], new Date(2026, 2, 4)),
    ).rejects.toThrow(/1-7/);
  });

  it("deja de preguntar cuando ya contestaste esta semana", async () => {
    const db = createTestDb();
    await db
      .insert(habits)
      .values({ id: "h1", name: "Leer", createdAt: new Date(2026, 0, 1) });
    const hoy = new Date(2026, 2, 4);

    expect((await estadoSrbai(db, hoy)).get("h1")!.tocaPreguntar).toBe(true);
    await guardarMedida(db, "h1", [4, 4, 4, 4], hoy);
    expect((await estadoSrbai(db, hoy)).get("h1")!.tocaPreguntar).toBe(false);

    // La semana siguiente vuelve a tocar.
    const otraSemana = new Date(2026, 2, 11);
    expect((await estadoSrbai(db, otraSemana)).get("h1")!.tocaPreguntar).toBe(
      true,
    );
  });

  it("no pregunta a un hábito recién creado", async () => {
    const db = createTestDb();
    const hoy = new Date(2026, 2, 4);
    await db
      .insert(habits)
      .values({ id: "h1", name: "Leer", createdAt: new Date(2026, 2, 1) });
    const e = (await estadoSrbai(db, hoy)).get("h1")!;
    expect(e.tocaPreguntar).toBe(false);
    expect(e.sugerencia.tipo).toBe("pronto");
  });
});
