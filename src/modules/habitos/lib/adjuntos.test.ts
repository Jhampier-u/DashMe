import { describe, expect, it, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createTestDb } from "@/modules/core/db/testing";
import { tasks } from "@/modules/habitos/schema";
import {
  addFileBytes,
  addLink,
  deleteAttachment,
  listAttachments,
  storedNamesOfTasks,
} from "./adjuntos";

const T0 = new Date(1700000000000);
const temporales: string[] = [];

/** Una carpeta de adjuntos de usar y tirar, para no escribir en `data/`. */
function dirTemporal(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "adjuntos-test-"));
  temporales.push(d);
  return d;
}

afterEach(() => {
  for (const d of temporales.splice(0)) {
    fs.rmSync(d, { recursive: true, force: true });
  }
});

async function conTarea() {
  const db = createTestDb();
  await db.insert(tasks).values({
    id: "t1",
    title: "Tarea",
    status: "TODO",
    order: 1,
    createdAt: T0,
    updatedAt: T0,
  });
  return db;
}

describe("addLink", () => {
  it("lo guarda y lo lista", async () => {
    const db = await conTarea();
    const r = await addLink(db, "t1", "Documento", "https://ejemplo.com/d");
    expect(r.ok).toBe(true);
    const lista = await listAttachments(db, "t1");
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({
      kind: "link",
      name: "Documento",
      url: "https://ejemplo.com/d",
    });
  });

  it("sin nombre usa el propio enlace", async () => {
    const db = await conTarea();
    await addLink(db, "t1", "  ", "https://ejemplo.com/d");
    expect((await listAttachments(db, "t1"))[0].name).toBe(
      "https://ejemplo.com/d",
    );
  });

  it("rechaza un esquema que ejecuta", async () => {
    const db = await conTarea();
    const r = await addLink(db, "t1", "x", "javascript:alert(1)");
    expect(r).toEqual({ ok: false, motivo: "esquema" });
    expect(await listAttachments(db, "t1")).toHaveLength(0);
  });
});

describe("addFileBytes", () => {
  it("escribe el archivo y guarda la fila", async () => {
    const db = await conTarea();
    const dir = dirTemporal();
    const bytes = Buffer.from("hola");

    const r = await addFileBytes(
      db,
      "t1",
      { name: "saludo.txt", size: bytes.length, mime: "text/plain" },
      bytes,
      dir,
    );
    expect(r.ok).toBe(true);

    const [a] = await listAttachments(db, "t1");
    expect(a.name).toBe("saludo.txt");
    expect(a.storedAs).not.toBe("saludo.txt");
    expect(fs.readFileSync(path.join(dir, a.storedAs!), "utf8")).toBe("hola");
  });

  it("rechaza uno que pasa del tope y NO escribe nada", async () => {
    const db = await conTarea();
    const dir = dirTemporal();

    const r = await addFileBytes(
      db,
      "t1",
      {
        name: "grande.bin",
        size: 51 * 1024 * 1024,
        mime: "application/octet-stream",
      },
      Buffer.from("x"),
      dir,
    );
    expect(r).toEqual({ ok: false, motivo: "grande" });
    expect(await listAttachments(db, "t1")).toHaveLength(0);
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  /*
    Dos archivos con el mismo nombre son el caso normal —`escaneo.pdf` dos
    veces— y no deben pisarse. Es lo que compra el nombre generado.
  */
  it("dos con el mismo nombre no se pisan", async () => {
    const db = await conTarea();
    const dir = dirTemporal();
    const meta = { name: "escaneo.pdf", size: 1, mime: "application/pdf" };
    await addFileBytes(db, "t1", meta, Buffer.from("a"), dir);
    await addFileBytes(db, "t1", meta, Buffer.from("b"), dir);

    expect(fs.readdirSync(dir)).toHaveLength(2);
    const lista = await listAttachments(db, "t1");
    expect(lista[0].storedAs).not.toBe(lista[1].storedAs);
  });
});

describe("deleteAttachment", () => {
  it("borra la fila y el archivo", async () => {
    const db = await conTarea();
    const dir = dirTemporal();
    await addFileBytes(
      db,
      "t1",
      { name: "x.txt", size: 1, mime: "text/plain" },
      Buffer.from("a"),
      dir,
    );
    const [a] = await listAttachments(db, "t1");

    await deleteAttachment(db, a.id, dir);

    expect(await listAttachments(db, "t1")).toHaveLength(0);
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  /*
    Quien haya borrado la carpeta a mano llega aquí. Que reventara al intentar
    limpiar dejaría la fila para siempre.
  */
  it("si el archivo ya no está, borra la fila sin quejarse", async () => {
    const db = await conTarea();
    const dir = dirTemporal();
    await addFileBytes(
      db,
      "t1",
      { name: "x.txt", size: 1, mime: "text/plain" },
      Buffer.from("a"),
      dir,
    );
    const [a] = await listAttachments(db, "t1");
    fs.rmSync(path.join(dir, a.storedAs!));

    await expect(deleteAttachment(db, a.id, dir)).resolves.not.toThrow();
    expect(await listAttachments(db, "t1")).toHaveLength(0);
  });
});

describe("storedNamesOfTasks", () => {
  /*
    Esto es lo que hay que llamar ANTES de borrar las tareas. La foránea es en
    cascada, así que al borrarlas las filas de adjuntos desaparecen solas —y con
    ellas el único sitio donde estaba escrito cómo se llama cada archivo en
    disco—.
  */
  it("trae solo los archivos: un enlace no ocupa disco", async () => {
    const db = await conTarea();
    const dir = dirTemporal();
    await addFileBytes(
      db,
      "t1",
      { name: "x.txt", size: 1, mime: "text/plain" },
      Buffer.from("a"),
      dir,
    );
    await addLink(db, "t1", "e", "https://ejemplo.com");

    const nombres = await storedNamesOfTasks(db, ["t1", "inexistente"]);

    expect(nombres).toHaveLength(1);
  });

  it("con la lista vacía no consulta y devuelve vacío", async () => {
    const db = await conTarea();
    expect(await storedNamesOfTasks(db, [])).toEqual([]);
  });
});
