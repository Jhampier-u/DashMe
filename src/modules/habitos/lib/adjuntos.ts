import { asc, eq, inArray } from "drizzle-orm";
import fs from "node:fs/promises";
import type { Db } from "@/modules/core/db";
import { taskAttachments } from "@/modules/habitos/schema";
import {
  DIR_ADJUNTOS,
  nuevoNombreEnDisco,
  rutaDeAdjunto,
  validarEnlace,
  validarSubida,
  type Veredicto,
} from "./adjuntos-ruta";

export type Adjunto = {
  id: string;
  kind: "file" | "link";
  name: string;
  url: string | null;
  storedAs: string | null;
  size: number | null;
  mime: string | null;
  createdAt: Date;
};

export async function listAttachments(
  db: Db,
  taskId: string,
): Promise<Adjunto[]> {
  const filas = await db
    .select()
    .from(taskAttachments)
    .where(eq(taskAttachments.taskId, taskId))
    .orderBy(asc(taskAttachments.createdAt));
  return filas.map((f) => ({
    id: f.id,
    kind: f.kind === "file" ? "file" : "link",
    name: f.name,
    url: f.url,
    storedAs: f.storedAs,
    size: f.size,
    mime: f.mime,
    createdAt: f.createdAt,
  }));
}

export async function addLink(
  db: Db,
  taskId: string,
  name: string,
  url: string,
): Promise<Veredicto> {
  const v = validarEnlace(url);
  if (!v.ok) return v;
  const limpia = url.trim();
  await db.insert(taskAttachments).values({
    id: crypto.randomUUID(),
    taskId,
    kind: "link",
    // Sin nombre, el propio enlace: una lista de «(sin nombre)» no sirve de nada.
    name: name.trim() || limpia,
    url: limpia,
    createdAt: new Date(),
  });
  return { ok: true };
}

/**
 * Guarda un archivo.
 *
 * Recibe los bytes ya leídos y no un `File`, para poder probarla sin inventar
 * uno. Quien la llama desde el server action hace el `arrayBuffer()`.
 *
 * VALIDA ANTES DE ESCRIBIR. Al revés dejaría en disco archivos que la base no
 * conoce cada vez que alguien pasa del tope.
 */
export async function addFileBytes(
  db: Db,
  taskId: string,
  meta: { name: string; size: number; mime: string },
  bytes: Buffer | Uint8Array,
  base: string = DIR_ADJUNTOS,
): Promise<Veredicto> {
  const v = validarSubida(meta);
  if (!v.ok) return v;

  const storedAs = nuevoNombreEnDisco();
  const destino = rutaDeAdjunto(storedAs, base);
  // Imposible con un nombre recién generado; si pasara, no se escribe nada.
  if (!destino) return { ok: false, motivo: "ruta" };

  await fs.mkdir(base, { recursive: true });
  await fs.writeFile(destino, bytes);

  await db.insert(taskAttachments).values({
    id: crypto.randomUUID(),
    taskId,
    kind: "file",
    name: meta.name.trim(),
    storedAs,
    size: meta.size,
    mime: meta.mime || "application/octet-stream",
    createdAt: new Date(),
  });
  return { ok: true };
}

/** Borra un archivo de disco. Que no esté NO es un error. */
export async function borrarDeDisco(
  storedAs: string,
  base: string = DIR_ADJUNTOS,
): Promise<void> {
  const ruta = rutaDeAdjunto(storedAs, base);
  if (!ruta) return;
  // `force`: quien haya borrado la carpeta a mano llega aquí, y que reventara
  // al intentar limpiar dejaría la fila para siempre.
  await fs.rm(ruta, { force: true });
}

export async function deleteAttachment(
  db: Db,
  id: string,
  base: string = DIR_ADJUNTOS,
): Promise<void> {
  if (!id) return;
  const [a] = await db
    .select({ storedAs: taskAttachments.storedAs })
    .from(taskAttachments)
    .where(eq(taskAttachments.id, id))
    .limit(1);

  // La fila primero: si fallara el disco, es mejor un huérfano en la carpeta que
  // una fila que enseña un adjunto roto.
  await db.delete(taskAttachments).where(eq(taskAttachments.id, id));
  if (a?.storedAs) await borrarDeDisco(a.storedAs, base);
}

/**
 * Los nombres en disco de los archivos de unas tareas.
 *
 * Se llama ANTES de borrar esas tareas. La foránea es en cascada, así que al
 * borrarlas sus filas de adjuntos desaparecen solas, y con ellas el único sitio
 * donde estaba escrito cómo se llama cada archivo en disco. Quien borre primero
 * y pregunte después deja huérfanos para siempre.
 */
export async function storedNamesOfTasks(
  db: Db,
  taskIds: string[],
): Promise<string[]> {
  if (taskIds.length === 0) return [];
  const filas = await db
    .select({ storedAs: taskAttachments.storedAs })
    .from(taskAttachments)
    .where(inArray(taskAttachments.taskId, taskIds));
  return filas
    .map((f) => f.storedAs)
    .filter((s): s is string => s !== null && s.length > 0);
}
