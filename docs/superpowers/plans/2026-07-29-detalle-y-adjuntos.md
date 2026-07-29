# Detalle de tarea y adjuntos · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cada tarea tenga su página en `/tareas/<id>` donde se edita todo y se le cuelgan archivos y enlaces.

**Architecture:** Una tabla `task_attachments` para archivos y enlaces. Los archivos van a `data/adjuntos/` con nombre generado y se sirven por una ruta que solo acepta ids. La lógica de rutas y validación es pura y se prueba aparte, porque es la parte con riesgo.

**Tech Stack:** Next 16.2.12 · Drizzle sobre SQLite · vitest 4.1 · `node:fs/promises`

**Spec:** `docs/superpowers/specs/2026-07-29-detalle-y-adjuntos-design.md`

---

## Antes de empezar: lee esto

**Este es el primer código del repo que escribe en el disco del usuario.** Los
tres puntos de abajo no son estilo, son la diferencia entre una carpeta de
adjuntos y una vía para leer o escribir donde no se debe.

**1. El nombre en disco es un UUID a secas, sin extensión.** No es el nombre que
subió el usuario, ni lo lleva pegado. Así dos archivos iguales no se pisan, y un
nombre con `../` no puede llegar a la ruta. La ruta de descarga además
**comprueba que el nombre tiene forma de UUID** antes de tocar el disco: es una
lista blanca, mucho más fuerte que buscar `..`.

**2. Los enlaces se validan por esquema.** Solo `http:` y `https:`. Un
`javascript:...` guardado y pintado en un `href` es ejecución de código en tu
sesión, y basta con pegarlo en el campo.

**3. La descarga va con `Content-Disposition: attachment`, nunca `inline`.**
Servir un HTML o un SVG subido por el usuario en el mismo origen que la
aplicación es un agujero de script. Forzar la descarga lo cierra.

**El tope está en DOS sitios y tienen que cuadrar:** 50 MB en el código y 51 MB
en `next.config.ts`. El megabyte de diferencia es para los bordes y metadatos de
`multipart`, que la documentación de Next cifra en 10–20 KB. Si subes uno y no el
otro, el fallo aparece solo con archivos grandes.

**`migrar.ts` NO se toca.** Aquí solo se añade una tabla, y para eso ya sirve el
`CREATE TABLE IF NOT EXISTS` de `SCHEMA_SQL`. `migrar.ts` existe para añadir
*columnas* a tablas que ya están.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/modules/habitos/lib/adjuntos-ruta.ts` | **Nuevo.** Puro: nombres, rutas y validación |
| `src/modules/habitos/lib/adjuntos-ruta.test.ts` | **Nuevo.** La travesía de rutas y el tope |
| `src/modules/habitos/lib/adjuntos.ts` | **Nuevo.** Base y disco: listar, añadir, borrar |
| `src/modules/habitos/lib/adjuntos.test.ts` | **Nuevo.** |
| `src/modules/core/db/schema-sql.ts` | `task_attachments` |
| `src/modules/habitos/schema.ts` | Lo mismo en Drizzle |
| `src/modules/habitos/lib/mutations.ts` | El borrado en tres pasos |
| `src/app/api/adjunto/[id]/route.ts` | **Nuevo.** La descarga |
| `src/app/tareas/[id]/page.tsx` | **Nuevo.** El detalle |
| `src/modules/habitos/components/tasks/AttachmentList.tsx` | **Nuevo.** |
| `src/modules/habitos/components/tasks/TaskDetail.tsx` | **Nuevo.** Edición en línea |
| `next.config.ts` | `bodySizeLimit` |

---

### Tarea 1: Lo puro y con riesgo

**Files:**
- Create: `src/modules/habitos/lib/adjuntos-ruta.ts`
- Create: `src/modules/habitos/lib/adjuntos-ruta.test.ts`

- [x] **Paso 1: Escribir el test**

`src/modules/habitos/lib/adjuntos-ruta.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import path from "node:path";
import {
  LIMITE_BYTES,
  esNombreEnDisco,
  nuevoNombreEnDisco,
  rutaDeAdjunto,
  validarEnlace,
  validarSubida,
} from "./adjuntos-ruta";

const BASE = path.join("C:", "datos", "adjuntos");

describe("nuevoNombreEnDisco", () => {
  it("no se parece al nombre original", () => {
    const n = nuevoNombreEnDisco();
    expect(n).not.toContain("factura");
    expect(esNombreEnDisco(n)).toBe(true);
  });

  /*
    Sin extensión, a propósito. No hace falta —el tipo va en `mime` y el nombre
    de la descarga en `name`— y pegar la del usuario reabriría la puerta que
    esto cierra.
  */
  it("no lleva extensión", () => {
    expect(path.extname(nuevoNombreEnDisco())).toBe("");
  });

  it("no repite", () => {
    const n = new Set(Array.from({ length: 200 }, () => nuevoNombreEnDisco()));
    expect(n.size).toBe(200);
  });
});

describe("esNombreEnDisco", () => {
  it("acepta un UUID", () => {
    expect(esNombreEnDisco("0c5fd419-f19e-403f-9da9-ad7144175d54")).toBe(true);
  });

  /*
    Es una LISTA BLANCA y no una búsqueda de `..`. Buscar lo malo siempre se
    queda corto —codificaciones, barras de Windows, nombres raros de NTFS—;
    exigir la forma exacta de un UUID no.
  */
  it("rechaza cualquier cosa que no lo sea", () => {
    for (const malo of [
      "..",
      "../../data/juampi.db",
      "..\\..\\data\\juampi.db",
      "%2e%2e%2f",
      "0c5fd419-f19e-403f-9da9-ad7144175d54.exe",
      "0c5fd419-f19e-403f-9da9-ad7144175d54/../x",
      "",
      "aaaa",
      "0C5FD419-F19E-403F-9DA9-AD7144175D5",
    ]) {
      expect(esNombreEnDisco(malo), malo).toBe(false);
    }
  });
});

describe("rutaDeAdjunto", () => {
  it("compone la ruta dentro de la carpeta", () => {
    const r = rutaDeAdjunto("0c5fd419-f19e-403f-9da9-ad7144175d54", BASE);
    expect(r).toBe(path.join(BASE, "0c5fd419-f19e-403f-9da9-ad7144175d54"));
  });

  /*
    EL CASO QUE IMPORTA. Sin esto, `/api/adjunto/../../data/juampi.db`
    descargaría la base entera, con el histórico de música y todo lo demás.
  */
  it("devuelve null ante cualquier intento de salirse", () => {
    expect(rutaDeAdjunto("../../data/juampi.db", BASE)).toBeNull();
    expect(rutaDeAdjunto("..", BASE)).toBeNull();
    expect(rutaDeAdjunto("a/b", BASE)).toBeNull();
  });

  it("la ruta que devuelve nunca se sale de la carpeta", () => {
    const r = rutaDeAdjunto(nuevoNombreEnDisco(), BASE);
    expect(r).not.toBeNull();
    expect(path.resolve(r!).startsWith(path.resolve(BASE))).toBe(true);
  });
});

describe("validarSubida", () => {
  it("acepta un archivo normal", () => {
    expect(validarSubida({ name: "factura.pdf", size: 1024 })).toEqual({
      ok: true,
    });
  });

  it("rechaza uno vacío", () => {
    expect(validarSubida({ name: "x", size: 0 })).toEqual({
      ok: false,
      motivo: "vacio",
    });
  });

  it("rechaza uno que pasa del tope", () => {
    expect(validarSubida({ name: "x", size: LIMITE_BYTES + 1 })).toEqual({
      ok: false,
      motivo: "grande",
    });
  });

  it("acepta uno justo en el tope", () => {
    expect(validarSubida({ name: "x", size: LIMITE_BYTES }).ok).toBe(true);
  });

  it("rechaza uno sin nombre", () => {
    expect(validarSubida({ name: "   ", size: 10 })).toEqual({
      ok: false,
      motivo: "sin-nombre",
    });
  });

  /*
    El tope del código y el de `next.config.ts` tienen que cuadrar, y el de Next
    va un poco por encima para los bordes de `multipart`. Si alguien sube uno y
    no el otro, el fallo aparece solo con archivos grandes.
  */
  it("el tope son 50 MB", () => {
    expect(LIMITE_BYTES).toBe(50 * 1024 * 1024);
  });
});

describe("validarEnlace", () => {
  it("acepta http y https", () => {
    expect(validarEnlace("https://ejemplo.com/x").ok).toBe(true);
    expect(validarEnlace("http://ejemplo.com").ok).toBe(true);
  });

  /*
    UN `javascript:` GUARDADO Y PINTADO EN UN href ES EJECUCIÓN DE CÓDIGO en la
    sesión del usuario, y basta con pegarlo en el campo. Se filtra por esquema
    permitido, no por lo que parezca sospechoso.
  */
  it("rechaza los esquemas que ejecutan", () => {
    for (const malo of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:x",
      "file:///C:/Windows",
    ]) {
      expect(validarEnlace(malo).ok, malo).toBe(false);
    }
  });

  it("rechaza lo que no es una URL", () => {
    expect(validarEnlace("").ok).toBe(false);
    expect(validarEnlace("ejemplo.com").ok).toBe(false);
  });
});
```

- [x] **Paso 2: Ejecutar y verlo fallar**

```bash
cd "/c/PROYECTO JUAMPI"
npx vitest run src/modules/habitos/lib/adjuntos-ruta.test.ts
```

Esperado: **FAIL**, `Cannot find module './adjuntos-ruta'`.

- [x] **Paso 3: Escribirlo**

`src/modules/habitos/lib/adjuntos-ruta.ts`:

```ts
import path from "node:path";

/*
  Todo lo delicado de los adjuntos, sin base de datos y sin disco.

  Está aparte porque es la única parte del repo donde un fallo no da un dato
  mal: da acceso a archivos que no son del usuario. Como funciones puras se
  prueba cada caso, incluidos los que nunca deberían llegar.
*/

/** La carpeta de los adjuntos, hermana de la base. */
export const DIR_ADJUNTOS = path.join(process.cwd(), "data", "adjuntos");

/**
 * 50 MB.
 *
 * Tiene que cuadrar con `serverActions.bodySizeLimit` de `next.config.ts`, que
 * va en 51: la documentación de Next advierte que `multipart/form-data` añade de
 * 10 a 20 KB de bordes y metadatos, así que apurar el límite exacto rompería
 * justo en los archivos grandes.
 */
export const LIMITE_BYTES = 50 * 1024 * 1024;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * ¿Tiene forma de nombre en disco?
 *
 * Es una LISTA BLANCA, y por eso es fuerte. Buscar `..` siempre se queda corto
 * —codificaciones, barras de Windows, nombres raros de NTFS—; exigir la forma
 * exacta de un UUID en minúsculas no deja nada por fuera.
 */
export function esNombreEnDisco(nombre: string): boolean {
  return UUID.test(nombre);
}

/**
 * El nombre con el que se guarda un archivo.
 *
 * NO es el que subió el usuario, y no lleva su extensión pegada. El nombre real
 * vive en la columna `name` de la base, solo para mostrarlo y para nombrar la
 * descarga.
 *
 * Así: dos archivos con el mismo nombre no se pisan, un nombre con `../` no
 * llega nunca a una ruta, y el contenido de la carpeta no cuenta de qué van tus
 * tareas.
 */
export function nuevoNombreEnDisco(): string {
  return crypto.randomUUID();
}

/**
 * La ruta en disco de un adjunto, o `null` si el nombre no es de fiar.
 *
 * Dos comprobaciones y no una: la forma del nombre, y que la ruta resuelta caiga
 * dentro de la carpeta. La segunda sobra si la primera está bien, y va de todos
 * modos — es lo único que separa `/api/adjunto/<id>` de servir la base entera.
 */
export function rutaDeAdjunto(
  nombre: string,
  base: string = DIR_ADJUNTOS,
): string | null {
  if (!esNombreEnDisco(nombre)) return null;
  const completa = path.resolve(base, nombre);
  const raiz = path.resolve(base);
  if (completa !== path.join(raiz, nombre)) return null;
  if (!completa.startsWith(raiz + path.sep)) return null;
  return completa;
}

export type Rechazo = { ok: false; motivo: string };
export type Veredicto = { ok: true } | Rechazo;

export function validarSubida(f: { name: string; size: number }): Veredicto {
  if (!f.name.trim()) return { ok: false, motivo: "sin-nombre" };
  if (f.size <= 0) return { ok: false, motivo: "vacio" };
  if (f.size > LIMITE_BYTES) return { ok: false, motivo: "grande" };
  return { ok: true };
}

/**
 * Solo `http:` y `https:`.
 *
 * Un `javascript:` guardado y pintado en un `href` es ejecución de código en la
 * sesión del usuario, y basta con pegarlo en el campo. Se filtra por esquema
 * PERMITIDO y no por lo que parezca sospechoso: la lista de lo malo nunca está
 * completa.
 */
export function validarEnlace(url: string): Veredicto {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return { ok: false, motivo: "no-es-url" };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { ok: false, motivo: "esquema" };
  }
  return { ok: true };
}
```

- [x] **Paso 4: Verificar**

```bash
npx vitest run src/modules/habitos/lib/adjuntos-ruta.test.ts && npx tsc --noEmit
```

Esperado: **PASS**, 17 afirmaciones.

**Aviso de la ejecución:** al tocar `next.config.ts` el servidor de desarrollo
se reinicia y regenera `.next/dev/types`. Si corres `tsc --noEmit` justo en ese
momento, verás decenas de errores en archivos generados —rutas que pasan a ser
`never`, `AppRouteHandlerRoutes` que no existe— que no son tuyos. Vuelve a
correrlo cuando el servidor haya acabado.

- [x] **Paso 5: El tope en la configuración**

En `next.config.ts`, dentro de `nextConfig`:

```ts
  experimental: {
    serverActions: {
      /*
        51 y no 50, que es el tope por archivo de `adjuntos-ruta.ts`. La
        diferencia es para los bordes, cabeceras de parte y metadatos que añade
        `multipart/form-data`, que la documentación de Next cifra en 10–20 KB.
        Apurar el límite exacto rompería justo en los archivos grandes.
      */
      bodySizeLimit: "51mb",
    },
  },
```

- [x] **Paso 6: Commit**

```bash
git add src/modules/habitos/lib/adjuntos-ruta.ts src/modules/habitos/lib/adjuntos-ruta.test.ts next.config.ts
git commit -m "feat(tareas): rutas y validacion de adjuntos, la parte con riesgo"
```

---

### Tarea 2: El esquema

**Files:**
- Modify: `src/modules/core/db/schema-sql.ts`
- Modify: `src/modules/habitos/schema.ts`

- [x] **Paso 1: El DDL**

En `src/modules/core/db/schema-sql.ts`, después del bloque de `tasks` y sus
índices:

```sql
CREATE TABLE IF NOT EXISTS task_attachments (
  id         TEXT PRIMARY KEY,
  task_id    TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  name       TEXT NOT NULL,
  url        TEXT,
  stored_as  TEXT,
  size       INTEGER,
  mime       TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS task_attachments_task_idx ON task_attachments(task_id);
```

> Al contrario que las columnas que se añadieron con ALTER, esta foránea SÍ la
> vigila el motor también en la base del usuario: la tabla es nueva y nace con
> ella declarada. Y sus índices SÍ pueden ir aquí por lo mismo: se crean junto a
> la tabla, no sobre una que ya existía sin las columnas.
>
> **Y no escribas acentos graves en los comentarios de este archivo.** Es una
> plantilla literal de JavaScript y cualquiera de ellos la cierra a media cadena.
> Pasó al ejecutar este mismo paso.

- [x] **Paso 2: Lo mismo en Drizzle**

En `src/modules/habitos/schema.ts`, después de `tasks`:

```ts
export const taskAttachments = sqliteTable(
  "task_attachments",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    /** 'file' | 'link' */
    kind: text("kind").notNull(),
    /** Lo que se muestra. En un archivo, el nombre con el que lo subiste. */
    name: text("name").notNull(),
    /** Solo los enlaces. */
    url: text("url"),
    /** Solo los archivos: su nombre EN DISCO, que es un UUID sin extensión. */
    storedAs: text("stored_as"),
    size: integer("size"),
    mime: text("mime"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => ({ byTask: index("task_attachments_task_idx").on(t.taskId) }),
);

export type TaskAttachmentRow = typeof taskAttachments.$inferSelect;
```

- [x] **Paso 3: Verificar**

```bash
npx vitest run tests/schema-parity.test.ts && npx tsc --noEmit
```

Ese test compara el DDL con las definiciones de Drizzle y cuenta las tablas.
Si falla en el recuento, revisa que no hayas escrito las dos palabras de la
sentencia de creación dentro de un comentario del DDL: las cuenta con una
expresión regular sobre el texto entero.

- [x] **Paso 4: Commit**

```bash
git add src/modules/core/db/schema-sql.ts src/modules/habitos/schema.ts
git commit -m "feat(tareas): la tabla de adjuntos"
```

---

### Tarea 3: Listar, añadir y borrar

**Files:**
- Create: `src/modules/habitos/lib/adjuntos.ts`
- Create: `src/modules/habitos/lib/adjuntos.test.ts`
- Modify: `src/modules/habitos/actions.ts`
- Modify: `src/modules/habitos/index.ts`

- [ ] **Paso 1: Escribir el test**

`src/modules/habitos/lib/adjuntos.test.ts`:

```ts
import { describe, expect, it, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createTestDb } from "@/modules/core/db/testing";
import { tasks } from "@/modules/habitos/schema";
import {
  addLink,
  addFileBytes,
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
      { name: "grande.bin", size: 51 * 1024 * 1024, mime: "application/octet-stream" },
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
  it("trae los nombres en disco de varias tareas", async () => {
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

    // Solo los archivos: un enlace no ocupa disco.
    expect(nombres).toHaveLength(1);
  });

  it("con la lista vacía no consulta y devuelve vacío", async () => {
    const db = await conTarea();
    expect(await storedNamesOfTasks(db, [])).toEqual([]);
  });
});
```

- [ ] **Paso 2: Ejecutar y verlo fallar**

```bash
npx vitest run src/modules/habitos/lib/adjuntos.test.ts
```

- [ ] **Paso 3: Escribirlo**

`src/modules/habitos/lib/adjuntos.ts`:

```ts
import { asc, eq, inArray } from "drizzle-orm";
import fs from "node:fs/promises";
import path from "node:path";
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
```

- [ ] **Paso 4: Los server actions**

En `src/modules/habitos/actions.ts`:

```ts
import * as adj from "./lib/adjuntos";

export async function anadirEnlace(taskId: string, name: string, url: string) {
  const r = await adj.addLink(db, taskId, name, url);
  refresh();
  return r;
}

/*
  Recibe el FormData entero y no un File, porque un File no sobrevive al paso
  por la frontera del server action si se pasa suelto en algunas versiones.
  Aquí se leen los bytes y se delega en `addFileBytes`, que es lo testeable.
*/
export async function anadirArchivo(taskId: string, formData: FormData) {
  const f = formData.get("file");
  if (!(f instanceof File)) return { ok: false as const, motivo: "sin-archivo" };
  const bytes = Buffer.from(await f.arrayBuffer());
  const r = await adj.addFileBytes(
    db,
    taskId,
    { name: f.name, size: f.size, mime: f.type },
    bytes,
  );
  refresh();
  return r;
}

export async function borrarAdjunto(id: string) {
  await adj.deleteAttachment(db, id);
  refresh();
}
```

Y en `src/modules/habitos/index.ts`:

```ts
export { listAttachments, type Adjunto } from "./lib/adjuntos";
```

- [ ] **Paso 5: Verificar**

```bash
npx vitest run && npx tsc --noEmit && npm run lint
```

- [ ] **Paso 6: Commit**

```bash
git add -A src
git commit -m "feat(tareas): guardar, listar y borrar adjuntos"
```

---

### Tarea 4: El borrado en tres pasos

**Files:**
- Modify: `src/modules/habitos/lib/mutations.ts`
- Modify: `src/modules/habitos/lib/integridad.test.ts`

- [ ] **Paso 1: El test**

Añade a `src/modules/habitos/lib/integridad.test.ts`:

```ts
describe("borrar una tarea con adjuntos", () => {
  /*
    El orden es lo que se prueba aquí. La foránea es en cascada: al borrar las
    tareas, sus filas de adjuntos desaparecen solas y con ellas los nombres de
    los archivos. Hay que LEERLOS antes o quedan huérfanos para siempre.
  */
  it("se lleva los archivos de todo el árbol", async () => {
    const db = basePuestaAlDia();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "adjuntos-borrado-"));
    await db.insert(tasks).values([tarea("padre"), tarea("hijo", { parentId: "padre" })]);
    for (const id of ["padre", "hijo"]) {
      await addFileBytes(
        db,
        id,
        { name: "x.txt", size: 1, mime: "text/plain" },
        Buffer.from("a"),
        dir,
      );
    }
    expect(fs.readdirSync(dir)).toHaveLength(2);

    await deleteTaskById(db, "padre", dir);

    expect(fs.readdirSync(dir)).toEqual([]);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
```

Con los imports que hagan falta arriba: `fs`, `os`, `path` y `addFileBytes`.

> `basePuestaAlDia()` crea la base con el esquema real, así que `task_attachments`
> existe y su foránea está declarada. No hay que tocar el fósil de `tasks`.

- [ ] **Paso 2: Ejecutar y verlo fallar**

```bash
npx vitest run src/modules/habitos/lib/integridad.test.ts
```

- [ ] **Paso 3: Los tres pasos**

En `deleteTaskById`, entre el cálculo de `aBorrar` y el `delete`:

```ts
  const ids = [...aBorrar];

  /*
    TRES pasos y no dos, y el orden importa:

    1. LEER los nombres en disco. La foránea es en cascada, así que en cuanto se
       borren las tareas estas filas se van con ellas y ya no habrá forma de
       saber qué archivos eran. Quien borre primero deja huérfanos para siempre.
    2. Borrar las tareas. Sus adjuntos caen por la cascada.
    3. Borrar los archivos. Si esto falla, lo peor es un huérfano en la carpeta,
       que no rompe nada. Al revés quedarían filas enseñando adjuntos roídos.
  */
  const enDisco = await storedNamesOfTasks(db, ids);

  await db.delete(tasks).where(inArray(tasks.id, ids));

  for (const nombre of enDisco) await borrarDeDisco(nombre, base);
```

Y la firma gana la carpeta, para poder probarla sin escribir en `data/`:

```ts
export async function deleteTaskById(db: Db, id: string, base?: string) {
```

Con el import:

```ts
import { borrarDeDisco, storedNamesOfTasks } from "./adjuntos";
```

- [ ] **Paso 4: Verificar**

```bash
npx vitest run && npx tsc --noEmit && npm run lint
```

- [ ] **Paso 5: Commit**

```bash
git add -A src
git commit -m "fix(tareas): borrar una tarea se lleva los archivos de su arbol"
```

---

### Tarea 5: La descarga

**Files:**
- Create: `src/app/api/adjunto/[id]/route.ts`

- [ ] **Paso 1: La ruta**

```ts
import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { db } from "@/modules/core/db";
import { taskAttachments } from "@/modules/habitos/schema";
import { rutaDeAdjunto } from "@/modules/habitos/lib/adjuntos-ruta";

/*
  Sirve un adjunto.

  RECIBE UN ID DE FILA, NUNCA UNA RUTA. El nombre en disco sale de la base, no
  de la URL. Si aceptara un nombre de la URL, `/api/adjunto/../../data/juampi.db`
  descargaría la base entera, con el histórico de música y todo lo demás.

  Y aunque el nombre venga de la base, `rutaDeAdjunto` vuelve a comprobar que
  tiene forma de UUID y que la ruta cae dentro de la carpeta. Es un cinturón
  sobre el tirante: una fila corrupta tampoco puede salirse.
*/
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const [a] = await db
    .select()
    .from(taskAttachments)
    .where(eq(taskAttachments.id, id))
    .limit(1);

  if (!a || a.kind !== "file" || !a.storedAs) {
    return new Response("No encontrado", { status: 404 });
  }

  const ruta = rutaDeAdjunto(a.storedAs);
  if (!ruta) return new Response("No encontrado", { status: 404 });

  let bytes: Buffer;
  try {
    bytes = await readFile(ruta);
  } catch {
    // El archivo se borró por debajo. La fila sigue; se responde 404 y la
    // pantalla lo cuenta, en vez de reventar.
    return new Response("El archivo ya no está", { status: 404 });
  }

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": a.mime ?? "application/octet-stream",
      /*
        `attachment` y NUNCA `inline`. Servir un HTML o un SVG subido por el
        usuario en el mismo origen que la aplicación es un agujero de script;
        forzar la descarga lo cierra.

        El nombre va entre comillas y sin comillas dentro, que romperían la
        cabecera.
      */
      "Content-Disposition": `attachment; filename="${a.name.replace(/["\r\n]/g, "")}"`,
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, no-store",
    },
  });
}
```

> `params` es una **promesa** en esta versión de Next, igual que `searchParams`.
> Compruébalo en `node_modules/next/dist/docs/` si el tipo no cuadra.

- [ ] **Paso 2: Verificar**

```bash
npx tsc --noEmit && npm run lint && npm run build
```

- [ ] **Paso 3: Commit**

```bash
git add src/app/api/adjunto
git commit -m "feat(tareas): la ruta de descarga solo acepta ids"
```

---

### Tarea 6: La página de detalle

**Files:**
- Create: `src/app/tareas/[id]/page.tsx`
- Create: `src/modules/habitos/components/tasks/AttachmentList.tsx`
- Create: `src/modules/habitos/components/tasks/TaskDetail.tsx`
- Modify: `src/modules/habitos/lib/tasks.ts`
- Modify: `src/modules/habitos/components/tasks/TaskCard.tsx`
- Modify: `src/modules/habitos/lib/mutations.ts`

- [ ] **Paso 1: La lectura**

En `src/modules/habitos/lib/tasks.ts`:

```ts
export type TaskDetalle = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  categoryId: string | null;
  priority: Prioridad | null;
  projectId: string | null;
  createdAt: Date;
  completedAt: Date | null;
  /** Sus descendientes, anidados. */
  arbol: TaskTreeNode<NodoArbol>[];
};

/** La tarea del detalle, con su rama del árbol. `null` si no existe. */
export async function getTask(db: Db, id: string): Promise<TaskDetalle | null> {
  const all = await db
    .select()
    .from(tasks)
    .orderBy(asc(tasks.order), asc(tasks.createdAt));
  const propia = all.find((t) => t.id === id);
  if (!propia) return null;

  /*
    UN solo camino y no dos. Se recogen los descendientes de esta tarea y se
    reanidan tratando a sus hijos directos como raíces.

    La alternativa —montar el árbol global y buscar el trozo— falla justo cuando
    la tarea es ella misma una subtarea: entonces no es raíz del árbol global y
    no está en el mapa. Dos caminos, y el segundo es el que se olvida de probar.
  */
  const hijosDirectos = new Set(
    all.filter((t) => t.parentId === id).map((t) => t.id),
  );
  const dentro = new Set(hijosDirectos);
  const cola = [...hijosDirectos];
  while (cola.length > 0) {
    const actual = cola.pop()!;
    for (const t of all) {
      if (t.parentId === actual && !dentro.has(t.id)) {
        dentro.add(t.id);
        cola.push(t.id);
      }
    }
  }

  const arbol = buildTaskTree(
    all
      .filter((t) => dentro.has(t.id))
      .map((t) => ({
        id: t.id,
        // Los hijos directos pasan a raíces de ESTA rama.
        parentId: hijosDirectos.has(t.id) ? null : t.parentId,
        title: t.title,
        status: (t.status as TaskStatus) ?? "TODO",
        order: t.order,
        createdAt: t.createdAt,
        completedAt: t.completedAt,
      })),
  );

  return {
    id: propia.id,
    title: propia.title,
    description: propia.description,
    status: (propia.status as TaskStatus) ?? "TODO",
    categoryId: propia.categoryId,
    priority: resolvePrioridad(propia.priority),
    projectId: propia.projectId,
    createdAt: propia.createdAt,
    completedAt: propia.completedAt,
    arbol,
  };
}
```

Y su test, en `tasks.test.ts`:

```ts
describe("getTask", () => {
  const base = { title: "x", status: "TODO", order: 1, createdAt: T0, updatedAt: T0 };

  it("devuelve null si no existe", async () => {
    expect(await getTask(createTestDb(), "fantasma")).toBeNull();
  });

  it("trae la rama de una raíz", async () => {
    const db = createTestDb();
    await db.insert(tasks).values([
      { ...base, id: "p" },
      { ...base, id: "h", parentId: "p" },
      { ...base, id: "n", parentId: "h" },
    ]);
    const t = await getTask(db, "p");
    expect(t!.arbol[0].id).toBe("h");
    expect(t!.arbol[0].children[0].id).toBe("n");
  });

  /*
    El caso que rompía el diseño de dos caminos: una SUBTAREA no es raíz del
    árbol global, así que buscarla en el mapa de raíces no la encontraba y su
    detalle salía sin subtareas.
  */
  it("trae la rama de una subtarea, que no es raíz del árbol global", async () => {
    const db = createTestDb();
    await db.insert(tasks).values([
      { ...base, id: "p" },
      { ...base, id: "h", parentId: "p" },
      { ...base, id: "n", parentId: "h" },
    ]);
    const t = await getTask(db, "h");
    expect(t!.arbol).toHaveLength(1);
    expect(t!.arbol[0].id).toBe("n");
  });

  it("una hoja trae el árbol vacío", async () => {
    const db = createTestDb();
    await db.insert(tasks).values({ ...base, id: "sola" });
    expect((await getTask(db, "sola"))!.arbol).toEqual([]);
  });
});
```

Expórtala en `index.ts`:

```ts
export { getTask, type TaskDetalle } from "./lib/tasks";
```

- [ ] **Paso 2: Editar el título y la descripción**

En `mutations.ts`, junto a `renameTask`:

```ts
export async function updateTaskDescription(
  db: Db,
  taskId: string,
  description: string,
) {
  if (!taskId) return;
  await db
    .update(tasks)
    .set({
      description: text(description, LIMITS.taskDescription),
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId));
}

export async function updateTaskCategory(
  db: Db,
  taskId: string,
  categoryId: string | null,
) {
  if (!taskId) return;
  await db
    .update(tasks)
    .set({ categoryId, updatedAt: new Date() })
    .where(eq(tasks.id, taskId));
}

export async function updateTaskPriority(
  db: Db,
  taskId: string,
  priority: string | null,
) {
  if (!taskId) return;
  await db
    .update(tasks)
    .set({ priority: resolvePrioridad(priority), updatedAt: new Date() })
    .where(eq(tasks.id, taskId));
}
```

> `text()` espera un `FormDataEntryValue | null`; pásale `description` tal cual,
> que es un `string` y le sirve.

Y sus tres envoltorios en `actions.ts`, con `refresh()`.

- [ ] **Paso 3: La lista de adjuntos**

`src/modules/habitos/components/tasks/AttachmentList.tsx`:

```tsx
"use client";

import { useRef, useState, useTransition } from "react";
import {
  anadirArchivo,
  anadirEnlace,
  borrarAdjunto,
} from "@/modules/habitos/actions";
import type { Adjunto } from "@/modules/habitos/lib/adjuntos";
import { Button } from "@/modules/core/ui/Button";
import { useConfirm } from "@/modules/habitos/components/ConfirmDialog";

const MOTIVOS: Record<string, string> = {
  grande: "Ese archivo pasa de 50 MB.",
  vacio: "Ese archivo está vacío.",
  "sin-nombre": "Ese archivo no tiene nombre.",
  "sin-archivo": "No se recibió ningún archivo.",
  esquema: "Solo enlaces http o https.",
  "no-es-url": "Eso no parece una dirección.",
  ruta: "No se pudo guardar el archivo.",
};

const CAMPO =
  "bg-paper-2 text-tinta font-cuerpo text-[13px] border-3 border-line " +
  "rounded-control px-2 py-1.5 placeholder:text-tinta-2 outline-none " +
  "focus:outline-3 focus:outline-offset-2 focus:outline-line";

function tamano(bytes: number | null): string {
  if (bytes === null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function AttachmentList({
  taskId,
  adjuntos,
}: {
  taskId: string;
  adjuntos: Adjunto[];
}) {
  const [aviso, setAviso] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [url, setUrl] = useState("");
  const [pending, startTransition] = useTransition();
  const archivo = useRef<HTMLInputElement>(null);
  const { confirm, dialog } = useConfirm();

  function subir(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const fd = new FormData();
    fd.set("file", f);
    startTransition(async () => {
      const r = await anadirArchivo(taskId, fd);
      setAviso(r.ok ? null : (MOTIVOS[r.motivo] ?? "No se pudo subir."));
      if (archivo.current) archivo.current.value = "";
    });
  }

  function enlazar() {
    if (!url.trim()) return;
    startTransition(async () => {
      const r = await anadirEnlace(taskId, nombre, url);
      if (r.ok) {
        setNombre("");
        setUrl("");
        setAviso(null);
      } else {
        setAviso(MOTIVOS[r.motivo] ?? "No se pudo añadir.");
      }
    });
  }

  async function borrar(a: Adjunto) {
    const ok = await confirm({
      title: "Borrar adjunto",
      message: `Se borrará "${a.name}".`,
    });
    if (!ok) return;
    startTransition(() => borrarAdjunto(a.id));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, opacity: pending ? 0.6 : 1 }}>
      {adjuntos.length === 0 ? (
        <p style={{ fontSize: 13 }}>Sin adjuntos.</p>
      ) : (
        <ul style={{ display: "flex", flexDirection: "column", gap: 8, listStyle: "none", padding: 0 }}>
          {adjuntos.map((a) => (
            <li key={a.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span aria-hidden style={{ fontSize: 14 }}>
                {a.kind === "file" ? "📎" : "🔗"}
              </span>
              <a
                href={a.kind === "file" ? `/api/adjunto/${a.id}` : (a.url ?? "#")}
                /* Los enlaces del usuario van a otro sitio; `noreferrer` para no
                   filtrar de dónde vienen. */
                {...(a.kind === "link"
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
                style={{ fontSize: 13, color: "var(--color-tinta)" }}
              >
                {a.name}
              </a>
              {a.kind === "file" ? (
                <span style={{ fontSize: 11.5 }}>{tamano(a.size)}</span>
              ) : null}
              <span style={{ flex: 1 }} />
              <button
                type="button"
                onClick={() => borrar(a)}
                aria-label={`Borrar ${a.name}`}
                className="px-2 py-0.5 rounded-control border-3 border-line bg-peach text-tinta font-cuerpo text-xs cursor-pointer"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {aviso ? <p style={{ fontSize: 12.5 }}>{aviso}</p> : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <input
          ref={archivo}
          type="file"
          onChange={subir}
          disabled={pending}
          className="text-[12.5px] font-cuerpo text-tinta"
        />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          className={`${CAMPO} w-56`}
        />
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre (opcional)"
          maxLength={120}
          className={`${CAMPO} w-44`}
        />
        <Button variant="secondary" size="sm" onClick={enlazar} disabled={pending || !url.trim()}>
          Añadir enlace
        </Button>
      </div>
      {dialog}
    </div>
  );
}
```

- [ ] **Paso 4: La página**

`src/app/tareas/[id]/page.tsx`: monta `PageHeader` con el título, el selector de
estado, el de categoría y el de prioridad, la descripción, `TaskTree` con
`parentId={tarea.id}` y `AttachmentList`. Devuelve `notFound()` si `getTask`
da `null`.

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/modules/core/db";
import { getTask, listCategorias, listAttachments } from "@/modules/habitos";
import { TaskDetail } from "@/modules/habitos/components/tasks/TaskDetail";

export const dynamic = "force-dynamic";

export default async function TaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [tarea, categorias, adjuntos] = await Promise.all([
    getTask(db, id),
    listCategorias(db),
    listAttachments(db, id),
  ]);
  if (!tarea) notFound();

  return (
    <main
      style={{
        minHeight: "100%",
        padding: "24px 16px 56px",
        background: "var(--color-paper)",
        color: "var(--color-tinta)",
        fontFamily: "var(--font-cuerpo)",
      }}
    >
      <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
        <Link href="/tareas" style={{ fontSize: 13, color: "var(--color-tinta)" }}>
          ← Todas las tareas
        </Link>
        <TaskDetail tarea={tarea} categorias={categorias} adjuntos={adjuntos} />
      </div>
    </main>
  );
}
```

- [ ] **Paso 4b: `TaskDetail`**

`src/modules/habitos/components/tasks/TaskDetail.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { Card } from "@/modules/core/ui/Card";
import { varColor } from "@/modules/core/ui/paleta";
import {
  cambiarCategoriaTarea,
  cambiarDescripcionTarea,
  cambiarPrioridadTarea,
  renameTask,
  updateTaskStatus,
} from "@/modules/habitos/actions";
import { emitStatusChange } from "@/modules/habitos/lib/events";
import type { Adjunto } from "@/modules/habitos/lib/adjuntos";
import type { Categoria } from "@/modules/habitos/lib/categorias";
import {
  PRIORIDADES,
  PRIORIDAD_DEFS,
  prioridadColorVar,
  type Prioridad,
} from "@/modules/habitos/lib/prioridad";
import {
  STATUS_LABEL,
  TASK_STATUSES,
  type TaskDetalle,
  type TaskStatus,
} from "@/modules/habitos/lib/tasks";
import { AttachmentList } from "./AttachmentList";
import { TaskTree } from "./TaskTree";

/** La cápsula de los selectores: la misma forma en los tres. */
const OPCION =
  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-control " +
  "border-3 border-line text-tinta font-cuerpo text-xs cursor-pointer " +
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-line";

const ROTULO = "block text-xs font-semibold text-tinta font-cuerpo mb-1.5";

const CAMPO =
  "w-full bg-paper-2 text-tinta font-cuerpo border-3 border-line " +
  "rounded-control px-2.5 py-2 outline-none " +
  "focus:outline-3 focus:outline-offset-2 focus:outline-line";

export function TaskDetail({
  tarea,
  categorias,
  adjuntos,
}: {
  tarea: TaskDetalle;
  categorias: Categoria[];
  adjuntos: Adjunto[];
}) {
  const [titulo, setTitulo] = useState(tarea.title);
  const [desc, setDesc] = useState(tarea.description ?? "");
  const [pending, startTransition] = useTransition();

  /*
    El título y la descripción se guardan al SALIR del campo, no con un botón.
    Es una pantalla de un solo objeto: un botón «guardar» por campo sobra, y uno
    global obligaría a mantener un estado de «sin guardar» que aquí no aporta.
  */
  function guardarTitulo() {
    const t = titulo.trim();
    if (!t || t === tarea.title) {
      setTitulo(tarea.title);
      return;
    }
    startTransition(() => renameTask(tarea.id, t));
  }

  function guardarDesc() {
    if (desc === (tarea.description ?? "")) return;
    startTransition(() => cambiarDescripcionTarea(tarea.id, desc));
  }

  function mover(s: TaskStatus) {
    startTransition(async () => {
      emitStatusChange(await updateTaskStatus(tarea.id, s));
    });
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        opacity: pending ? 0.6 : 1,
      }}
    >
      <Card>
        <label className={ROTULO} htmlFor="titulo">
          Título
        </label>
        <input
          id="titulo"
          value={titulo}
          maxLength={120}
          onChange={(e) => setTitulo(e.target.value)}
          onBlur={guardarTitulo}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") setTitulo(tarea.title);
          }}
          className={`${CAMPO} text-[15px] font-bold`}
        />

        <div style={{ marginTop: 14 }}>
          <label className={ROTULO} htmlFor="desc">
            Descripción
          </label>
          <textarea
            id="desc"
            value={desc}
            rows={4}
            maxLength={500}
            placeholder="Detalles…"
            onChange={(e) => setDesc(e.target.value)}
            onBlur={guardarDesc}
            className={`${CAMPO} text-[13.5px] resize-y placeholder:text-tinta-2`}
          />
        </div>
      </Card>

      <Card>
        <span className={ROTULO}>Estado</span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {TASK_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => mover(s)}
              aria-pressed={tarea.status === s}
              className={OPCION}
              style={{
                background:
                  tarea.status === s ? "var(--color-pink)" : "var(--color-paper)",
                boxShadow: tarea.status === s ? "var(--shadow-hard)" : "none",
              }}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 14 }}>
          <span className={ROTULO}>Prioridad</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {PRIORIDADES.map((p: Prioridad) => (
              <button
                key={p}
                type="button"
                onClick={() =>
                  startTransition(() =>
                    cambiarPrioridadTarea(
                      tarea.id,
                      tarea.priority === p ? null : p,
                    ),
                  )
                }
                aria-pressed={tarea.priority === p}
                className={OPCION}
                style={{
                  background:
                    tarea.priority === p
                      ? prioridadColorVar(p)
                      : "var(--color-paper)",
                  boxShadow:
                    tarea.priority === p ? "var(--shadow-hard)" : "none",
                }}
              >
                <span
                  style={{
                    width: PRIORIDAD_DEFS[p].punto,
                    height: PRIORIDAD_DEFS[p].punto,
                    borderRadius: 999,
                    background: prioridadColorVar(p),
                    border: "2px solid var(--color-line)",
                    flexShrink: 0,
                  }}
                />
                {PRIORIDAD_DEFS[p].label}
              </button>
            ))}
          </div>
        </div>

        {categorias.length > 0 ? (
          <div style={{ marginTop: 14 }}>
            <span className={ROTULO}>Categoría</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {categorias.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() =>
                    startTransition(() =>
                      cambiarCategoriaTarea(
                        tarea.id,
                        tarea.categoryId === c.id ? null : c.id,
                      ),
                    )
                  }
                  aria-pressed={tarea.categoryId === c.id}
                  className={OPCION}
                  style={{
                    background:
                      tarea.categoryId === c.id
                        ? varColor(c.color)
                        : "var(--color-paper)",
                    borderBottom: `3px solid ${varColor(c.color)}`,
                    boxShadow:
                      tarea.categoryId === c.id ? "var(--shadow-hard)" : "none",
                  }}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </Card>

      <Card>
        <span className={ROTULO}>Subtareas</span>
        <TaskTree roots={tarea.arbol} parentId={tarea.id} />
      </Card>

      <Card>
        <span className={ROTULO}>Adjuntos</span>
        <AttachmentList taskId={tarea.id} adjuntos={adjuntos} />
      </Card>
    </div>
  );
}
```

> Los tres envoltorios del paso 2 se llaman `cambiarDescripcionTarea`,
> `cambiarCategoriaTarea` y `cambiarPrioridadTarea`. Usa esos nombres al
> escribirlos para que este componente compile sin tocarlo.

> `Card` acepta `children` y un `style` opcional. Si su firma no encaja, mírala
> en `src/modules/core/ui/Card.tsx` antes de inventar otra superficie.

- [ ] **Paso 5: La tarjeta enlaza al detalle**

En `TaskCard.tsx`, el título pasa a ser un `Link` a `/tareas/${task.id}`,
conservando el subrayado de categoría y el tachado.

- [ ] **Paso 6: Verificar**

```bash
npx tsc --noEmit && npm run lint && npx vitest run && npm run build
```

- [ ] **Paso 7: Commit**

```bash
git add -A src
git commit -m "feat(tareas): la pagina de detalle con adjuntos"
```

---

### Tarea 7: Verificación final

- [ ] **Paso 1: Los cuatro comandos**

```bash
npm run lint && npx tsc --noEmit && npm run test && npm run build
```

- [ ] **Paso 2: Que la carpeta no entre en git**

```bash
mkdir -p data/adjuntos && touch data/adjuntos/prueba
git status --porcelain data/ | head
rm data/adjuntos/prueba
```

Esperado: **nada**. `data/` ya está en `.gitignore`.

- [ ] **Paso 3: La travesía de rutas, a mano**

Con el servidor en marcha:

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:3000/api/adjunto/..%2f..%2fdata%2fjuampi.db"
curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:3000/api/adjunto/inventado"
```

Esperado: **404 las dos**. Si alguna da 200, para y revisa `rutaDeAdjunto`.

- [ ] **Paso 4: En pantalla**

1. Crea una tarea y entra en su detalle desde el título.
2. Sube un archivo pequeño; compruébalo en `data/adjuntos/` — su nombre en disco
   NO debe parecerse al que subiste.
3. Descárgalo: tiene que bajar con el nombre original.
4. Añade un enlace y comprueba que abre en otra pestaña.
5. Pega `javascript:alert(1)` como enlace: debe rechazarlo con un mensaje.
6. Recarga la página: sigue ahí. Pulsa «atrás»: vuelve al tablero.
7. Borra la tarea y comprueba que `data/adjuntos/` se queda vacía.

- [ ] **Paso 5: Marcar el plan y el spec**

---

## Criterios de aceptación

- [ ] 1. `build`, `test`, `lint` y `tsc --noEmit` en verde
- [ ] 2. `/tareas/<id>` sobrevive a una recarga y responde a «atrás»
- [ ] 3. Se puede añadir, listar, descargar y borrar un archivo
- [ ] 4. Se puede añadir, listar y borrar un enlace
- [ ] 5. Un archivo de más de 50 MB se rechaza con un mensaje
- [ ] 6. `/api/adjunto/` con `../` responde 404
- [ ] 7. Un enlace `javascript:` se rechaza
- [ ] 8. Borrar una tarea borra los archivos de todo su árbol
- [ ] 9. Un archivo que falta en disco da 404 y no rompe la pantalla
- [ ] 10. Título, descripción, categoría y prioridad se editan desde el detalle
- [ ] 11. Nada de `data/adjuntos/` entra en git
