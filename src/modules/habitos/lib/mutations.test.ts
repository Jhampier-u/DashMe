import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "@/modules/core/db/testing";
import { habits, habitLogs, player, tasks } from "@/modules/habitos/schema";
import { dayKey } from "./day";
import { XP_PER_HABIT, XP_PER_TASK, ANCHOR_BONUS } from "./level";
import {
  createHabit,
  toggleToday,
  createTask,
  updateTaskStatus,
} from "./mutations";

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
