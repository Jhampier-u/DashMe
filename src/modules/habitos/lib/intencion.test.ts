import { describe, expect, it } from "vitest";
import { createTestDb } from "@/modules/core/db/testing";
import { habits } from "@/modules/habitos/schema";
import { updateHabitIntention } from "./mutations";
import { getHabitsWithTodayStatus } from "./habits";

/*
  LA INTENCIÓN — «cuando X, entonces Y».

  Es el campo con mejor respaldo del dashboard. Stawarz et al. (CHI 2015)
  midieron que anclar la conducta a un evento que ya ocurre aumenta la
  automaticidad, mientras que apoyarse en recordatorios por hora la DIFICULTA; y
  revisaron 115 apps de hábitos sin encontrar ninguna que soportara señales de
  ese tipo.

  `updateHabitIntention` existía como server action desde hacía tiempo y NADA en
  la interfaz la llamaba, así que un hábito creado sin intención no podía ganarla
  nunca. Estos tests nacen al conectarla.
*/

const T0 = new Date(1700000000000);

async function conHabito(intention: string | null = null) {
  const db = createTestDb();
  await db.insert(habits).values({
    id: "h1",
    name: "Leer",
    schedule: "1111111",
    intention,
    createdAt: T0,
  });
  return db;
}

describe("updateHabitIntention", () => {
  it("guarda la intención y la devuelve la consulta de la pantalla", async () => {
    const db = await conHabito();
    await updateHabitIntention(db, "h1", "Cuando cierre el portátil, leo");
    const [h] = await getHabitsWithTodayStatus(db);
    expect(h.intention).toBe("Cuando cierre el portátil, leo");
  });

  it("vaciar el campo la borra, en vez de dejar una cadena vacía", async () => {
    // Un `""` guardado haría que la fila creyera que hay intención y dejara de
    // sugerir ponerla, enseñando un hueco en blanco.
    const db = await conHabito("Algo viejo");
    await updateHabitIntention(db, "h1", "   ");
    const [h] = await getHabitsWithTodayStatus(db);
    expect(h.intention).toBeNull();
  });

  it("recorta los espacios de los lados", async () => {
    const db = await conHabito();
    await updateHabitIntention(db, "h1", "  Al salir de la ducha  ");
    const [h] = await getHabitsWithTodayStatus(db);
    expect(h.intention).toBe("Al salir de la ducha");
  });

  it("un id vacío no toca nada", async () => {
    const db = await conHabito("La de siempre");
    await updateHabitIntention(db, "", "otra cosa");
    const [h] = await getHabitsWithTodayStatus(db);
    expect(h.intention).toBe("La de siempre");
  });
});
