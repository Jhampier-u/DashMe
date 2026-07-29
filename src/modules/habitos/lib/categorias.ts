import { asc, count, eq, sql } from "drizzle-orm";
import type { Db } from "@/modules/core/db";
import { taskCategories, tasks } from "@/modules/habitos/schema";
import {
  PALETA_CATEGORICA,
  type ColorCategorico,
} from "@/modules/core/ui/paleta";

export const LIMITE_NOMBRE_CATEGORIA = 40;

/** El de por defecto: el acento de la marca en todo el dashboard. */
const COLOR_POR_DEFECTO: ColorCategorico = "pink";

export type Categoria = {
  id: string;
  name: string;
  color: ColorCategorico;
  taskCount: number;
};

export type ResultadoCategoria =
  | { ok: true; id: string }
  | { ok: false; motivo: "vacio" | "repetida" };

/**
 * Traduce el color guardado. Las OCHO claves valen, incluida `acid`: las
 * categorías no son identidad de hábito, así que no arrastran su exclusión.
 */
export function resolveCategoriaColor(stored: string): ColorCategorico {
  return stored in PALETA_CATEGORICA
    ? (stored as ColorCategorico)
    : COLOR_POR_DEFECTO;
}

/**
 * Busca por nombre sin distinguir mayúsculas.
 *
 * El índice único de la tabla ya lo impide, pero saltar el error del motor y
 * devolver un motivo es lo que permite decirle al usuario «esa ya existe» en
 * vez de enseñarle una excepción de SQLite.
 */
async function idPorNombre(db: Db, nombre: string): Promise<string | null> {
  const [fila] = await db
    .select({ id: taskCategories.id })
    .from(taskCategories)
    .where(sql`lower(${taskCategories.name}) = lower(${nombre})`)
    .limit(1);
  return fila?.id ?? null;
}

export async function listCategorias(db: Db): Promise<Categoria[]> {
  // Dos consultas y agrupación en memoria, como en `listProjects`: traer los
  // conteos de golpe evita una consulta por categoría.
  const [filas, usos] = await Promise.all([
    db.select().from(taskCategories).orderBy(asc(taskCategories.name)),
    db
      .select({ categoryId: tasks.categoryId, n: count() })
      .from(tasks)
      .groupBy(tasks.categoryId),
  ]);
  const porId = new Map(usos.map((u) => [u.categoryId, u.n]));
  return filas.map((c) => ({
    id: c.id,
    name: c.name,
    color: resolveCategoriaColor(c.color),
    taskCount: porId.get(c.id) ?? 0,
  }));
}

export async function createCategoria(
  db: Db,
  name: string,
  color: string,
): Promise<ResultadoCategoria> {
  const n = name.trim().slice(0, LIMITE_NOMBRE_CATEGORIA);
  if (!n) return { ok: false, motivo: "vacio" };
  if (await idPorNombre(db, n)) return { ok: false, motivo: "repetida" };
  const id = crypto.randomUUID();
  await db.insert(taskCategories).values({
    id,
    name: n,
    color: resolveCategoriaColor(color),
    createdAt: new Date(),
  });
  return { ok: true, id };
}

export async function renameCategoria(
  db: Db,
  id: string,
  name: string,
): Promise<ResultadoCategoria> {
  const n = name.trim().slice(0, LIMITE_NOMBRE_CATEGORIA);
  if (!n) return { ok: false, motivo: "vacio" };
  // `otra !== id` y no un simple «existe»: cambiarle las mayúsculas a una
  // categoría es renombrarla a un nombre que ya existe —el suyo—, y eso tiene
  // que estar permitido.
  const otra = await idPorNombre(db, n);
  if (otra && otra !== id) return { ok: false, motivo: "repetida" };
  await db
    .update(taskCategories)
    .set({ name: n })
    .where(eq(taskCategories.id, id));
  return { ok: true, id };
}

export async function setCategoriaColor(db: Db, id: string, color: string) {
  await db
    .update(taskCategories)
    .set({ color: resolveCategoriaColor(color) })
    .where(eq(taskCategories.id, id));
}

/**
 * Borra la categoría. Sus tareas SOBREVIVEN y se quedan sin categoría: lo
 * garantiza el `ON DELETE SET NULL` del esquema. Borrar una etiqueta no puede
 * llevarse trabajo por delante.
 */
export async function deleteCategoria(db: Db, id: string) {
  if (!id) return;
  await db.delete(taskCategories).where(eq(taskCategories.id, id));
}
