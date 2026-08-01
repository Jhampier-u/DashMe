import { describe, expect, it } from "vitest";
import { createTestDb } from "@/modules/core/db/testing";
import { gardenDecorations, player } from "@/modules/habitos/schema";
import { getLevelInfo } from "./level";
import { comprarDecoracion, decoracionesTuyas } from "./tienda";

const T0 = new Date(1700000000000);

async function conSaldo(xp: number, xpSpent = 0) {
  const db = createTestDb();
  await db.insert(player).values({
    id: "default",
    xp,
    xpSpent,
    shields: 2,
    shieldsUpdated: T0,
    createdAt: T0,
    updatedAt: T0,
  });
  return db;
}

async function jugador(db: Awaited<ReturnType<typeof conSaldo>>) {
  const [p] = await db.select().from(player);
  return p;
}

describe("comprarDecoracion", () => {
  it("resta el precio del saldo", async () => {
    // Criterio 2.
    const db = await conSaldo(200);
    const r = await comprarDecoracion(db, "piedra");
    expect(r.ok).toBe(true);
    expect((await jugador(db)).xp).toBe(150);
  });

  it("NO baja el nivel", async () => {
    /*
      Criterio 1, y el motivo de todo el trabajo previo. Antes el nivel salía de
      `player.xp` a secas, así que comprar te habría degradado: una tienda que
      te castiga por usarla no es una recompensa.
    */
    const db = await conSaldo(400);
    const antes = getLevelInfo(await jugador(db));
    await comprarDecoracion(db, "estanque");
    const despues = getLevelInfo(await jugador(db));
    expect(despues.level).toBe(antes.level);
    expect(despues.ganado).toBe(antes.ganado);
    expect(despues.xp).toBe(50);
  });

  it("apunta lo gastado, que es lo que sostiene el nivel", async () => {
    const db = await conSaldo(400);
    await comprarDecoracion(db, "estanque");
    expect((await jugador(db)).xpSpent).toBe(350);
  });

  it("guarda la decoración", async () => {
    const db = await conSaldo(200);
    await comprarDecoracion(db, "piedra");
    expect(await decoracionesTuyas(db)).toEqual(["piedra"]);
  });

  it("sin saldo no compra NADA, ni la fila ni el descuento", async () => {
    // Criterio 3. Lo importante no es solo que no compre: es que no deje el
    // saldo tocado a medias.
    const db = await conSaldo(40);
    const r = await comprarDecoracion(db, "piedra");
    expect(r).toEqual({
      ok: false,
      razon: { puede: false, motivo: "sin-saldo", faltan: 10 },
    });
    expect((await jugador(db)).xp).toBe(40);
    expect((await jugador(db)).xpSpent).toBe(0);
    expect(await db.select().from(gardenDecorations)).toHaveLength(0);
  });

  it("no deja comprar dos veces la misma", async () => {
    // Criterio 4.
    const db = await conSaldo(500);
    await comprarDecoracion(db, "piedra");
    const r = await comprarDecoracion(db, "piedra");
    expect(r).toEqual({
      ok: false,
      razon: { puede: false, motivo: "ya-es-tuya" },
    });
    // Y sobre todo: no cobra dos veces.
    expect((await jugador(db)).xp).toBe(450);
  });

  it("rechaza una decoración que no existe sin tocar el saldo", async () => {
    const db = await conSaldo(9999);
    const r = await comprarDecoracion(db, "dragon");
    expect(r).toEqual({
      ok: false,
      razon: { puede: false, motivo: "no-existe" },
    });
    expect((await jugador(db)).xp).toBe(9999);
  });

  it("comprar varias va sumando el gasto", async () => {
    const db = await conSaldo(1000);
    await comprarDecoracion(db, "piedra");
    await comprarDecoracion(db, "valla");
    const p = await jugador(db);
    expect(p.xp).toBe(830);
    expect(p.xpSpent).toBe(170);
    expect(getLevelInfo(p).ganado).toBe(1000);
    expect(await decoracionesTuyas(db)).toEqual(["piedra", "valla"]);
  });

  it("sin jugador todavía, el saldo es cero y no revienta", async () => {
    // `getOrCreatePlayer` crea la fila al ganar el primer XP. Llegar aquí antes
    // significa que no has ganado nada, no que la tienda esté rota.
    const db = createTestDb();
    const r = await comprarDecoracion(db, "piedra");
    expect(r).toMatchObject({ ok: false });
  });
});

describe("decoracionesTuyas", () => {
  it("descarta una fila con un `kind` que ya no existe", async () => {
    // La base guarda texto. Si colara, la escena buscaría un sprite ausente.
    const db = await conSaldo(0);
    await db
      .insert(gardenDecorations)
      .values({ kind: "dragon", precio: 10, createdAt: T0 });
    expect(await decoracionesTuyas(db)).toEqual([]);
  });

  it("está vacío en un jardín recién estrenado", async () => {
    // Criterio 7: sin nada comprado, la escena se ve exactamente como antes.
    expect(await decoracionesTuyas(await conSaldo(0))).toEqual([]);
  });
});
