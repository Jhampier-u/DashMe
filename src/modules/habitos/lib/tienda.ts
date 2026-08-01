import { eq, sql } from "drizzle-orm";
import type { Db } from "@/modules/core/db";
import { gardenDecorations, player as playerTable } from "../schema";
import {
  TIENDA,
  esDecoracion,
  puedeComprar,
  type Decoracion,
  type Rechazo,
} from "./decoraciones";
import { getLevelInfo, type LevelInfo } from "./level";

/*
  Comprar decoraciones. El catálogo y la regla de si puedes o no viven en
  `decoraciones.ts`, que es puro; aquí solo está lo que toca la base.
*/

/** Lo que tienes comprado, en orden de compra. */
export async function decoracionesTuyas(db: Db): Promise<Decoracion[]> {
  const filas = await db
    .select({ kind: gardenDecorations.kind })
    .from(gardenDecorations)
    .orderBy(gardenDecorations.createdAt);
  // El filtro no es paranoia: la base guarda texto, y una fila escrita por una
  // versión anterior con un `kind` que ya no existe buscaría un sprite ausente.
  return filas.map((f) => f.kind).filter(esDecoracion);
}

/**
 * Compra una decoración.
 *
 * Todo va en UNA transacción síncrona —en better-sqlite3, `db.transaction` de
 * Drizzle devuelve el valor y no una promesa—. Restar el saldo, sumar el
 * gastado e insertar la fila son tres cosas que solo tienen sentido juntas: con
 * dos de las tres te quedarías sin XP y sin adorno, o con el adorno gratis.
 *
 * Devuelve el motivo cuando no se puede, con el número de XP que faltan.
 */
export async function comprarDecoracion(
  db: Db,
  kind: string,
): Promise<{ ok: false; razon: Rechazo } | { ok: true; player: LevelInfo }> {
  if (!esDecoracion(kind)) {
    // Decir «ya es tuya» de algo que no existe sería mentir sobre el motivo.
    return { ok: false, razon: { puede: false, motivo: "no-existe" } };
  }

  const [jugador] = await db
    .select()
    .from(playerTable)
    .where(eq(playerTable.id, "default"));
  // Sin jugador no hay saldo que gastar. `getOrCreatePlayer` lo crea al ganar el
  // primer XP, así que llegar aquí antes significa saldo cero.
  const saldo = jugador?.xp ?? 0;
  const gastado = jugador?.xpSpent ?? 0;

  const tuyas = await decoracionesTuyas(db);
  const veredicto = puedeComprar(kind, saldo, tuyas);
  if (!veredicto.puede) return { ok: false, razon: veredicto };

  const precio = TIENDA[kind].precio;
  const ahora = new Date();

  db.transaction((tx) => {
    tx.update(playerTable)
      .set({
        // En SQL y no leer-modificar-escribir: dos compras a la vez no se pisan.
        xp: sql`${playerTable.xp} - ${precio}`,
        xpSpent: sql`${playerTable.xpSpent} + ${precio}`,
        updatedAt: ahora,
      })
      .where(eq(playerTable.id, "default"))
      .run();
    tx.insert(gardenDecorations)
      .values({ kind, precio, createdAt: ahora })
      .run();
  });

  return {
    ok: true,
    player: getLevelInfo({ xp: saldo - precio, xpSpent: gastado + precio }),
  };
}
