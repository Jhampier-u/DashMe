"use server";

import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { db } from "@/modules/core/db";
import { requireSession } from "@/modules/musica/lib/require-session";
import { insertStreams } from "@/modules/musica/lib/streams";
import { resolveTimeZone } from "@/modules/musica/lib/stats/local-time";
import { parseDumpRecords, type DumpRecord } from "./parse-dump";
import { registrarTanda, tandaPorHash } from "./batches";
import { aplicarDumpManda } from "./dump-wins";

const DIRECTORIO = path.join(process.cwd(), "data", "import");

export type ArchivoDisponible = {
  nombre: string;
  bytes: number;
  /** Fecha de una importación previa con el mismo contenido, si la hubo. */
  importadoAntes: number | null;
};

export type ResultadoArchivo = {
  nombre: string;
  leidos: number;
  insertados: number;
  descartados: number;
  audiolibros: number;
  invalidos: number;
  desde: number | null;
  hasta: number | null;
  error?: string;
};

/**
 * Solo nombres de archivo, nunca rutas.
 *
 * Toda Server Action exportada es un endpoint HTTP público que puede invocarse
 * con los argumentos que quiera quien la llame. Aceptar una ruta sería un
 * directory traversal servido en bandeja, así que el nombre recibido se
 * contrasta contra el listado real del directorio antes de abrir nada.
 */
function esNombreSeguro(nombre: string): boolean {
  return (
    nombre === path.basename(nombre) &&
    !nombre.startsWith(".") &&
    nombre.endsWith(".json")
  );
}

export async function listarArchivos(): Promise<ArchivoDisponible[]> {
  await requireSession();

  let entradas: string[];
  try {
    entradas = await fs.readdir(DIRECTORIO);
  } catch {
    return [];
  }

  const archivos: ArchivoDisponible[] = [];

  for (const nombre of entradas.sort()) {
    if (!esNombreSeguro(nombre)) continue;

    const completa = path.join(DIRECTORIO, nombre);
    const stat = await fs.stat(completa);
    if (!stat.isFile()) continue;

    const contenido = await fs.readFile(completa);
    const hash = createHash("sha256").update(contenido).digest("hex");
    const previa = await tandaPorHash(db, hash);

    archivos.push({
      nombre,
      bytes: stat.size,
      importadoAntes: previa?.importedAt ?? null,
    });
  }

  return archivos;
}

export async function importarArchivo(
  nombre: string,
): Promise<ResultadoArchivo> {
  await requireSession();

  const vacio: ResultadoArchivo = {
    nombre,
    leidos: 0,
    insertados: 0,
    descartados: 0,
    audiolibros: 0,
    invalidos: 0,
    desde: null,
    hasta: null,
  };

  if (!esNombreSeguro(nombre)) {
    return { ...vacio, error: "Nombre de archivo no permitido." };
  }

  const disponibles = await fs.readdir(DIRECTORIO).catch((): string[] => []);
  if (!disponibles.includes(nombre)) {
    return { ...vacio, error: "El archivo no está en data/import." };
  }

  try {
    const timeZone = resolveTimeZone(process.env);
    const contenido = await fs.readFile(path.join(DIRECTORIO, nombre));
    const hash = createHash("sha256").update(contenido).digest("hex");

    const registros = JSON.parse(contenido.toString("utf8")) as DumpRecord[];
    if (!Array.isArray(registros)) {
      return { ...vacio, error: "El archivo no contiene una lista de registros." };
    }

    const r = parseDumpRecords(registros, timeZone);
    const insertados = await insertStreams(db, r.filas);

    await registrarTanda(db, {
      filename: nombre,
      fileHash: hash,
      format: "extended",
      rowsRead: registros.length,
      rowsInserted: insertados,
      rowsSkipped: r.descartados,
      rowsInvalid: r.invalidos,
      rangeStart: r.desde,
      rangeEnd: r.hasta,
      status: "ok",
    });

    revalidatePath("/ajustes");
    revalidatePath("/");

    return {
      nombre,
      leidos: registros.length,
      insertados,
      descartados: r.descartados,
      audiolibros: r.audiolibros,
      invalidos: r.invalidos,
      desde: r.desde,
      hasta: r.hasta,
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);

    await registrarTanda(db, {
      filename: nombre,
      fileHash: "",
      format: "extended",
      rowsRead: 0,
      rowsInserted: 0,
      rowsSkipped: 0,
      rowsInvalid: 0,
      rangeStart: null,
      rangeEnd: null,
      status: `error: ${error}`,
    }).catch(() => {});

    return { ...vacio, error };
  }
}

/**
 * Cierra la tanda aplicando la regla D2 sobre el rango completo importado.
 *
 * Se invoca una sola vez, cuando el cliente ha terminado todos los archivos.
 */
export async function cerrarImportacion(
  desde: number | null,
  hasta: number | null,
): Promise<{ borradas: number }> {
  await requireSession();
  const borradas = await aplicarDumpManda(db, desde, hasta);

  revalidatePath("/ajustes");
  revalidatePath("/");

  return { borradas };
}
