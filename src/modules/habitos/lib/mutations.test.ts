import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "@/modules/core/db/testing";
import { habits, habitLogs, player, tasks } from "@/modules/habitos/schema";
import { dayKey } from "./day";
import { XP_PER_HABIT, XP_PER_TASK, ANCHOR_BONUS } from "./level";
import { EARLY_QUEST_HOUR } from "./quests";
import {
  createHabit,
  toggleToday,
  createTask,
  updateTaskStatus,
  setHabitCount,
} from "./mutations";

/*
  EL RELOJ, CONGELADO — y congelado AQUÍ ARRIBA, que es la parte que importa.

  Estos tests marcan hábitos, y marcar un hábito puede completar una misión
  diaria, que da XP de más. Qué misiones existen depende de la FECHA
  —`pickQuestsForDate` reparte tres de las cinco según el día— y si toca la de
  «antes de las 10», también de la HORA a la que corras la suite. El resultado
  era un test que pasaba por la tarde y fallaba por la mañana.

  Va antes de `HOY` porque `HOY` se calcula al importar el módulo, o sea ANTES
  de cualquier `beforeEach`. Congelando solo dentro del gancho, `HOY` se quedaba
  con la fecha real mientras el código bajo prueba veía la falsa, y las dos no
  coincidían.

  Se falsea solo `Date`, no los temporizadores: falsear `setTimeout` colgaría el
  código asíncrono de debajo.

  LA HORA ES LOAD-BEARING, y conviene decirlo en vez de fingir que no: a las
  nueve de la mañana salta la misión «antes de las 10» y sus 30 XP se cuelan en
  los tests que cuentan el XP total. Congelar el reloj quita el azar, no el
  acoplamiento — así que el acoplamiento se vigila abajo con un test propio, para
  que mover este instante dé un fallo que se explica solo en vez de dos
  descuadres de XP incomprensibles.
*/
const MOMENTO = new Date(2026, 6, 15, 15, 0, 0);
vi.useFakeTimers({ toFake: ["Date"] });
vi.setSystemTime(MOMENTO);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(MOMENTO);
});

afterEach(() => {
  vi.useRealTimers();
});

const HOY = dayKey();

function form(pairs: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(pairs)) fd.set(k, v);
  return fd;
}

type Db = ReturnType<typeof createTestDb>;

async function nuevoHabito(db: Db, extra: Record<string, string> = {}) {
  await createHabit(db, form({ name: "Leer 30 minutos", ...extra }));
  const [h] = await db.select().from(habits);
  return h;
}

describe("ciclo completo de un hábito", () => {
  it("crear, marcar y desmarcar deja el XP en cero", async () => {
    const db = createTestDb();
    const h = await nuevoHabito(db);
    expect(h.name).toBe("Leer 30 minutos");

    const marcado = await toggleToday(db, h.id);
    expect(marcado.ok).toBe(true);
    expect(marcado.done).toBe(true);

    const logs = await db
      .select()
      .from(habitLogs)
      .where(eq(habitLogs.habitId, h.id));
    expect(logs).toHaveLength(1);

    const [p1] = await db.select().from(player);
    expect(p1.xp).toBeGreaterThan(0);
    // Lo concedido queda grabado en el registro para poder devolverlo entero.
    expect(logs[0].xpAwarded).toBeGreaterThanOrEqual(XP_PER_HABIT);

    const desmarcado = await toggleToday(db, h.id);
    expect(desmarcado.done).toBe(false);

    expect(
      await db.select().from(habitLogs).where(eq(habitLogs.habitId, h.id)),
    ).toHaveLength(0);
    const [p2] = await db.select().from(player);
    // Marcar y desmarcar en bucle no puede generar XP.
    expect(p2.xp).toBe(0);
  });

  it("tres toggles dejan el hábito marcado una sola vez", async () => {
    const db = createTestDb();
    const h = await nuevoHabito(db);

    await toggleToday(db, h.id);
    await toggleToday(db, h.id);
    await toggleToday(db, h.id);

    expect(
      await db.select().from(habitLogs).where(eq(habitLogs.habitId, h.id)),
    ).toHaveLength(1);
  });

  it("el modo mínimo concede la mitad del XP base", async () => {
    const db = createTestDb();
    const h = await nuevoHabito(db);

    await toggleToday(db, h.id, true);

    const [log] = await db.select().from(habitLogs);
    expect(log.partial).toBe(true);
    expect(log.xpAwarded).toBe(Math.floor(XP_PER_HABIT / 2));
  });

  it("el hábito ancla suma su bonus", async () => {
    const db = createTestDb();
    const h = await nuevoHabito(db, { isAnchor: "on" });
    expect(h.isAnchor).toBe(true);

    const r = await toggleToday(db, h.id);

    expect(r.anchorTriggered).toBe(true);
    const [log] = await db.select().from(habitLogs);
    expect(log.xpAwarded).toBe(XP_PER_HABIT + ANCHOR_BONUS);
  });

  it("solo puede haber un hábito ancla", async () => {
    const db = createTestDb();
    await createHabit(db, form({ name: "Primero", isAnchor: "on" }));
    await createHabit(db, form({ name: "Segundo", isAnchor: "on" }));

    const anclas = (await db.select().from(habits)).filter((h) => h.isAnchor);

    expect(anclas).toHaveLength(1);
    expect(anclas[0].name).toBe("Segundo");
  });

  it("borrar un hábito arrastra sus registros", async () => {
    const db = createTestDb();
    const h = await nuevoHabito(db);
    await toggleToday(db, h.id);

    await db.delete(habits).where(eq(habits.id, h.id));

    // Depende de foreign_keys = ON. Sin ese pragma SQLite lo ignora en silencio
    // y quedan registros huérfanos.
    expect(await db.select().from(habitLogs)).toHaveLength(0);
  });

  it("no marca un hábito que no existe", async () => {
    const r = await toggleToday(createTestDb(), "no-existe");

    expect(r.ok).toBe(false);
    expect(r.reason).toBe("not-found");
  });
});

describe("tareas", () => {
  it("completar concede XP y descompletar lo devuelve", async () => {
    const db = createTestDb();
    await createTask(db, form({ title: "Escribir el spec" }));
    const [t] = await db.select().from(tasks);

    const hecha = await updateTaskStatus(db, t.id, "DONE");
    expect(hecha.becameDone).toBe(true);
    const [p1] = await db.select().from(player);
    expect(p1.xp).toBeGreaterThanOrEqual(XP_PER_TASK);

    await updateTaskStatus(db, t.id, "TODO");
    const [p2] = await db.select().from(player);
    expect(p2.xp).toBe(0);
  });

  it("marca completedAt al cerrar y lo limpia al reabrir", async () => {
    const db = createTestDb();
    await createTask(db, form({ title: "Una tarea" }));
    const [t] = await db.select().from(tasks);

    await updateTaskStatus(db, t.id, "DONE");
    const [cerrada] = await db.select().from(tasks);
    expect(cerrada.completedAt).toBeInstanceOf(Date);

    await updateTaskStatus(db, t.id, "IN_PROGRESS");
    const [reabierta] = await db.select().from(tasks);
    expect(reabierta.completedAt).toBeNull();
  });

  it("rechaza un estado que no existe", async () => {
    const db = createTestDb();
    await createTask(db, form({ title: "Una tarea" }));
    const [t] = await db.select().from(tasks);

    const r = await updateTaskStatus(
      db,
      t.id,
      "INVENTADO" as unknown as "TODO",
    );

    expect(r.becameDone).toBe(false);
    const [sinCambios] = await db.select().from(tasks);
    expect(sinCambios.status).toBe("TODO");
  });

  it("ignora una tarea sin título", async () => {
    const db = createTestDb();

    await createTask(db, form({ title: "   " }));

    expect(await db.select().from(tasks)).toHaveLength(0);
  });
});

describe("las misiones del día no descuadran el XP", () => {
  it("marcar y desmarcar sigue sumando cero aunque haya misiones activas", async () => {
    const db = createTestDb();
    const h = await nuevoHabito(db);

    await toggleToday(db, h.id);
    await toggleToday(db, h.id);

    const [p] = await db.select().from(player);
    expect(p.xp).toBe(0);
    expect(await db.select().from(habitLogs)).toHaveLength(0);
    expect(HOY.getTime()).toBeLessThanOrEqual(Date.now());
  });
});

describe("updateTaskStatus con cascada", () => {
  const TC = new Date(1700000000000);
  const t = (id: string, parentId: string | null, status = "TODO") => ({
    id,
    title: id,
    status,
    order: 1,
    parentId,
    createdAt: TC,
    updatedAt: TC,
  });

  it("cierra a los descendientes", async () => {
    const db = createTestDb();
    await db.insert(tasks).values([t("p", null), t("h", "p"), t("n", "h")]);

    await updateTaskStatus(db, "p", "DONE");

    const filas = await db.select().from(tasks);
    expect(filas.every((f) => f.status === "DONE")).toBe(true);
  });

  it("les pone fecha de cierre, que es de donde salen las métricas", async () => {
    const db = createTestDb();
    await db.insert(tasks).values([t("p", null), t("h", "p")]);

    await updateTaskStatus(db, "p", "DONE");

    const filas = await db.select().from(tasks);
    expect(filas.every((f) => f.completedAt !== null)).toBe(true);
  });

  it("al reabrir, la fecha de cierre se borra", async () => {
    const db = createTestDb();
    await db.insert(tasks).values([t("p", null), t("h", "p")]);
    await updateTaskStatus(db, "p", "DONE");

    await updateTaskStatus(db, "h", "TODO");

    const [padre] = await db.select().from(tasks).where(eq(tasks.id, "p"));
    expect(padre.status).toBe("TODO");
    expect(padre.completedAt).toBeNull();
  });

  /*
    La razón por la que se eligió dar XP por toda la cascada: el premio no debe
    depender del orden de los clics. Este test es esa frase, comprobada.
  */
  it("da el mismo XP de arriba abajo que de abajo arriba", async () => {
    const abajoArriba = createTestDb();
    await abajoArriba
      .insert(tasks)
      .values([t("p", null), t("h1", "p"), t("h2", "p")]);
    await updateTaskStatus(abajoArriba, "h1", "DONE");
    const r1 = await updateTaskStatus(abajoArriba, "h2", "DONE");

    const arribaAbajo = createTestDb();
    await arribaAbajo
      .insert(tasks)
      .values([t("p", null), t("h1", "p"), t("h2", "p")]);
    const r2 = await updateTaskStatus(arribaAbajo, "p", "DONE");

    expect(r1.player.xp).toBe(r2.player.xp);
  });

  it("dice cuántas se movieron", async () => {
    const db = createTestDb();
    await db.insert(tasks).values([t("p", null), t("h1", "p"), t("h2", "p")]);

    const r = await updateTaskStatus(db, "p", "DONE");

    expect(r.cambiadas).toBe(3);
  });

  it("becameDone sigue hablando de la tarea que tocaste", async () => {
    const db = createTestDb();
    await db.insert(tasks).values([t("p", null), t("h", "p")]);

    const r = await updateTaskStatus(db, "h", "DONE");

    expect(r.becameDone).toBe(true);
  });

  it("desmarcar un padre no toca a sus hijos", async () => {
    const db = createTestDb();
    await db.insert(tasks).values([t("p", null), t("h", "p")]);
    await updateTaskStatus(db, "p", "DONE");

    await updateTaskStatus(db, "p", "TODO");

    const [hijo] = await db.select().from(tasks).where(eq(tasks.id, "h"));
    expect(hijo.status).toBe("DONE");
  });
});

describe("hábitos con cantidad", () => {
  const TQ = new Date(1700000000000);

  async function conObjetivo(target: number | null) {
    const db = createTestDb();
    await db.insert(habits).values({
      id: "h1",
      name: "Agua",
      schedule: "1111111",
      targetCount: target,
      createdAt: TQ,
    });
    return db;
  }

  it("llegar al objetivo cuenta como completo", async () => {
    const db = await conObjetivo(8);
    await setHabitCount(db, "h1", 8);
    const [l] = await db.select().from(habitLogs);
    expect(l.count).toBe(8);
    expect(l.partial).toBe(false);
  });

  it("quedarse corto cuenta como a medias", async () => {
    const db = await conObjetivo(8);
    await setHabitCount(db, "h1", 5);
    const [l] = await db.select().from(habitLogs);
    expect(l.count).toBe(5);
    expect(l.partial).toBe(true);
  });

  it("apuntar cero borra el registro del día", async () => {
    const db = await conObjetivo(8);
    await setHabitCount(db, "h1", 5);
    await setHabitCount(db, "h1", 0);
    expect(await db.select().from(habitLogs)).toHaveLength(0);
  });

  /*
    Volver a apuntar el mismo día ACTUALIZA, no inserta: el índice único de
    (habit_id, date) lo impide, y de él depende el cálculo de rachas.
  */
  it("apuntar dos veces el mismo día no duplica", async () => {
    const db = await conObjetivo(8);
    await setHabitCount(db, "h1", 3);
    await setHabitCount(db, "h1", 8);
    const filas = await db.select().from(habitLogs);
    expect(filas).toHaveLength(1);
    expect(filas[0].count).toBe(8);
    expect(filas[0].partial).toBe(false);
  });

  it("subir dentro del mismo tramo solo mueve el número", async () => {
    const db = await conObjetivo(8);
    await setHabitCount(db, "h1", 2);
    const r = await setHabitCount(db, "h1", 3);
    const filas = await db.select().from(habitLogs);
    expect(filas[0].count).toBe(3);
    expect(filas[0].partial).toBe(true);
    // Ni XP ni eventos: el día ya estaba registrado y sigue corto.
    expect(r.xpDelta).toBe(0);
    expect(r.milestone).toBeNull();
  });

  it("un hábito sin objetivo no acepta cantidad", async () => {
    const db = await conObjetivo(null);
    const r = await setHabitCount(db, "h1", 5);
    expect(r.reason).toBe("no-target");
    expect(await db.select().from(habitLogs)).toHaveLength(0);
  });

  /*
    El XP tiene que cuadrar en las dos direcciones: subir de corto a pleno da la
    diferencia, no el total otra vez.
  */
  it("subir del corto al objetivo ajusta el XP, no lo duplica", async () => {
    const db = await conObjetivo(8);
    const corto = await setHabitCount(db, "h1", 3);
    expect(corto.player.xp).toBe(Math.floor(XP_PER_HABIT / 2));
    const pleno = await setHabitCount(db, "h1", 8);
    expect(pleno.player.xp).toBe(XP_PER_HABIT);
  });

  it("bajar del objetivo al corto también ajusta", async () => {
    const db = await conObjetivo(8);
    await setHabitCount(db, "h1", 8);
    const corto = await setHabitCount(db, "h1", 2);
    expect(corto.player.xp).toBe(Math.floor(XP_PER_HABIT / 2));
  });
});

describe("el reloj congelado de este archivo", () => {
  it("cae después de la misión «antes de las 10»", () => {
    /*
      Si mueves `MOMENTO` a antes de esta hora, esa misión se completa al marcar
      un hábito y suma 30 XP a los tests que comprueban el XP total. Este test
      existe para que eso salga como «la hora está mal elegida» y no como
      «esperaba 12 y llegó 42».
    */
    expect(MOMENTO.getHours()).toBeGreaterThanOrEqual(EARLY_QUEST_HOUR);
  });

  it("es la misma en todos los tests, sin depender de cuándo corras la suite", () => {
    expect(Date.now()).toBe(MOMENTO.getTime());
  });
});
