# Importador del historial de Spotify — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Meter los ocho años de historial del *Extended Streaming History* en la tabla `streams`, de forma idempotente y sin perder lo ya capturado.

**Architecture:** Un parser puro convierte cada registro del dump en una fila de `streams`; una capa de servidor lee los archivos del disco y los inserta por lotes, uno por llamada; al cerrar la tanda se aplica la regla de que el dump manda en su propio rango. La interfaz vive en `/ajustes`.

**Tech Stack:** Next.js 16 (App Router, Server Actions), TypeScript, SQLite vía better-sqlite3 + Drizzle ORM, Vitest.

**Diseño de referencia:** [`docs/superpowers/specs/2026-07-27-voidtify-estadisticas-escucha-design.md`](../specs/2026-07-27-voidtify-estadisticas-escucha-design.md), decisiones D2 y D7 y sección 6.3.

**Rama:** `feat/estadisticas-escucha`

---

## El dump real, ya inspeccionado

No hay que suponer nada: el archivo del usuario está analizado.

```
22 archivos  Streaming_History_Audio_YYYY[_N].json
277.941 registros    277.580 de música    361 de podcast, vídeo o audiolibro
10.674 artistas distintos      6.934 horas
2018-09-17T00:38:38Z  →  2026-07-26T23:54:57Z
```

Un registro completo, tal cual viene:

```json
{
  "ts": "2018-09-17T00:38:38Z",
  "platform": "Android-tablet OS 8.0.0 API 26 (HUAWEI, LG)",
  "ms_played": 550,
  "conn_country": "EC",
  "ip_addr": "186.43.233.220",
  "master_metadata_track_name": "Options",
  "master_metadata_album_artist_name": "Mr. Pig",
  "master_metadata_album_album_name": "Options",
  "spotify_track_uri": "spotify:track:5xcXVUm3JiXR3OAuZHqW04",
  "episode_name": null,
  "episode_show_name": null,
  "spotify_episode_uri": null,
  "audiobook_title": null,
  "audiobook_uri": null,
  "audiobook_chapter_uri": null,
  "audiobook_chapter_title": null,
  "reason_start": "clickrow",
  "reason_end": "endplay",
  "shuffle": false,
  "skipped": false,
  "offline": false,
  "offline_timestamp": null,
  "incognito_mode": false
}
```

**Cuatro diferencias respecto a lo que asumía el diseño original**, todas confirmadas sobre los datos:

1. **`ts` es una cadena ISO**, no un epoch. `Date.parse` la resuelve.
2. **`shuffle` y `skipped` son booleanos**, y la columna es `INTEGER`. Hay que convertir.
3. **Existen campos de audiolibro** que en 2018 no existían. Como no traen `master_metadata_track_name`, el filtro de música ya los descarta — pero conviene contarlos aparte y no mezclarlos con los podcasts.
4. **`ip_addr` viene en las 277.941 filas.** Es el dato más sensible del paquete y no aporta nada a unas estadísticas de escucha. **No se almacena.** Tampoco `conn_country`, `incognito_mode` ni `offline_timestamp`.

**El solapamiento con la captura es de horas.** El dump acaba el 26 de julio a las 23:54; la captura empezó el 27. La regla D2 apenas tendrá que borrar nada.

---

## Estructura de archivos

**Se crean:**

| Archivo | Responsabilidad |
|---|---|
| `src/lib/import/parse-dump.ts` | Convierte registros del dump en filas de `streams`. Puro |
| `src/lib/import/import-actions.ts` | Server actions: listar archivos e importar uno |
| `src/lib/import/batches.ts` | Lectura y escritura de `import_batches` |
| `src/components/ImportPanel.tsx` | Interfaz de importación en `/ajustes` |

**Se modifican:**

| Archivo | Cambio |
|---|---|
| `src/app/ajustes/page.tsx` | Añade el panel de importación |
| `README.md` | Documenta cómo importar |

**Fuera de este plan:** el módulo `skips.ts`, que ya tendrá datos con los que trabajar en cuanto esto termine, y las fichas de canción y álbum.

---

## Convenciones

**El parser es puro.** Sin red, sin base de datos, sin `server-only`. Recibe objetos y devuelve filas. Eso es lo que permite probarlo exhaustivamente sin tocar nada.

**La base se pasa como argumento**, igual que en `insertStreams` y en todo `src/lib/stats/`. `src/db/index.ts` abre el archivo real al importarse.

**Un archivo por llamada.** El cliente recorre la lista. Evita una petición de varios minutos y localiza cualquier fallo en un archivo concreto.

---

## Task 1: El parser

**Files:**
- Create: `src/lib/import/parse-dump.ts`
- Test: `tests/parse-dump.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crea `tests/parse-dump.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseDumpRecords, type DumpRecord } from "@/lib/import/parse-dump";

const TZ = "America/Guayaquil";

function registro(over: Partial<DumpRecord> = {}): DumpRecord {
  return {
    ts: "2019-03-15T18:30:00Z",
    platform: "android",
    ms_played: 210_000,
    master_metadata_track_name: "Alison",
    master_metadata_album_artist_name: "Slowdive",
    master_metadata_album_album_name: "Souvlaki",
    spotify_track_uri: "spotify:track:abc",
    reason_start: "clickrow",
    reason_end: "endplay",
    shuffle: false,
    skipped: false,
    ...over,
  };
}

describe("parseDumpRecords", () => {
  it("convierte un registro en una fila", () => {
    const { filas } = parseDumpRecords([registro()], TZ);
    expect(filas).toHaveLength(1);

    const f = filas[0];
    expect(f.ts).toBe(Date.UTC(2019, 2, 15, 18, 30, 0));
    expect(f.msPlayed).toBe(210_000);
    expect(f.trackName).toBe("Alison");
    expect(f.artistName).toBe("Slowdive");
    expect(f.albumName).toBe("Souvlaki");
    expect(f.trackUri).toBe("spotify:track:abc");
    expect(f.source).toBe("import");
  });

  it("normaliza las claves de agrupación", () => {
    const { filas } = parseDumpRecords([registro()], TZ);
    expect(filas[0].artistKey).toBe("slowdive");
    expect(filas[0].trackKey).toBe("slowdive\u001Falison");
    expect(filas[0].albumKey).toBe("slowdive\u001Fsouvlaki");
  });

  it("calcula la fecha y hora locales", () => {
    // 18:30 UTC son las 13:30 en Guayaquil.
    const { filas } = parseDumpRecords([registro()], TZ);
    expect(filas[0].localDate).toBe("2019-03-15");
    expect(filas[0].localHour).toBe(13);
  });

  it("convierte los booleanos a 0 y 1", () => {
    const { filas } = parseDumpRecords(
      [registro({ shuffle: true, skipped: false })],
      TZ,
    );
    expect(filas[0].shuffle).toBe(1);
    expect(filas[0].skipped).toBe(0);
  });

  it("acepta booleanos nulos o ausentes", () => {
    const { filas } = parseDumpRecords(
      [registro({ shuffle: null, skipped: undefined })],
      TZ,
    );
    expect(filas[0].shuffle).toBeNull();
    expect(filas[0].skipped).toBeNull();
  });

  it("conserva reason_start, reason_end y platform", () => {
    const { filas } = parseDumpRecords([registro()], TZ);
    expect(filas[0].reasonStart).toBe("clickrow");
    expect(filas[0].reasonEnd).toBe("endplay");
    expect(filas[0].platform).toBe("android");
  });

  it("construye el dedup_key con el timestamp y el uri", () => {
    const { filas } = parseDumpRecords([registro()], TZ);
    expect(filas[0].dedupKey).toBe(
      `${Date.UTC(2019, 2, 15, 18, 30, 0)}:spotify:track:abc`,
    );
  });

  it("usa track_key en el dedup_key cuando no hay uri", () => {
    const { filas } = parseDumpRecords(
      [registro({ spotify_track_uri: null })],
      TZ,
    );
    expect(filas[0].trackUri).toBeNull();
    expect(filas[0].dedupKey).toBe(
      `${Date.UTC(2019, 2, 15, 18, 30, 0)}:slowdive\u001Falison`,
    );
  });

  it("descarta podcasts y cuenta cuántos", () => {
    const podcast = registro({
      master_metadata_track_name: null,
      master_metadata_album_artist_name: null,
      episode_name: "Un episodio",
      spotify_episode_uri: "spotify:episode:xyz",
    });

    const r = parseDumpRecords([registro(), podcast], TZ);
    expect(r.filas).toHaveLength(1);
    expect(r.descartados).toBe(1);
  });

  it("descarta audiolibros y los cuenta aparte de los podcasts", () => {
    const audiolibro = registro({
      master_metadata_track_name: null,
      master_metadata_album_artist_name: null,
      audiobook_title: "Un libro",
      audiobook_uri: "spotify:audiobook:xyz",
    });

    const r = parseDumpRecords([registro(), audiolibro], TZ);
    expect(r.filas).toHaveLength(1);
    expect(r.descartados).toBe(1);
    expect(r.audiolibros).toBe(1);
  });

  it("descarta registros sin artista", () => {
    const r = parseDumpRecords(
      [registro({ master_metadata_album_artist_name: null })],
      TZ,
    );
    expect(r.filas).toHaveLength(0);
    expect(r.descartados).toBe(1);
  });

  it("cuenta como inválido un registro con fecha imposible", () => {
    const r = parseDumpRecords([registro({ ts: "no-es-fecha" })], TZ);
    expect(r.filas).toHaveLength(0);
    expect(r.invalidos).toBe(1);
  });

  it("una entrada corrupta no interrumpe el resto", () => {
    const r = parseDumpRecords(
      [registro(), registro({ ts: "roto" }), registro({ ts: "2019-03-16T18:30:00Z" })],
      TZ,
    );
    expect(r.filas).toHaveLength(2);
    expect(r.invalidos).toBe(1);
  });

  it("conserva las reproducciones cortas", () => {
    // El umbral de 30 s se aplica al consultar, no al importar: sin las cortas
    // no se puede analizar el abandono, que es justo lo que el dump permite.
    const r = parseDumpRecords([registro({ ms_played: 550 })], TZ);
    expect(r.filas).toHaveLength(1);
    expect(r.filas[0].msPlayed).toBe(550);
  });

  it("nunca almacena la dirección IP ni el país", () => {
    const conIp = registro() as DumpRecord & Record<string, unknown>;
    conIp.ip_addr = "186.43.233.220";
    conIp.conn_country = "EC";
    conIp.incognito_mode = false;

    const { filas } = parseDumpRecords([conIp], TZ);
    const serializada = JSON.stringify(filas[0]);

    expect(serializada).not.toContain("186.43.233.220");
    expect(serializada).not.toContain("ip_addr");
    expect(serializada).not.toContain("conn_country");
  });

  it("informa del rango temporal de lo parseado", () => {
    const r = parseDumpRecords(
      [
        registro({ ts: "2019-06-01T00:00:00Z" }),
        registro({ ts: "2018-01-01T00:00:00Z", spotify_track_uri: "spotify:track:x" }),
        registro({ ts: "2020-12-31T00:00:00Z", spotify_track_uri: "spotify:track:y" }),
      ],
      TZ,
    );

    expect(r.desde).toBe(Date.UTC(2018, 0, 1));
    expect(r.hasta).toBe(Date.UTC(2020, 11, 31));
  });

  it("devuelve desde y hasta nulos si no hubo filas válidas", () => {
    const r = parseDumpRecords([registro({ ts: "roto" })], TZ);
    expect(r.desde).toBeNull();
    expect(r.hasta).toBeNull();
  });
});
```

**Aviso sobre `\u001F`:** en este proyecto los escapes se corrompen al escribir archivos — cuatro veces ya. Deben quedar como los seis caracteres literales barra-u-cero-cero-uno-efe en el código fuente, nunca como el byte de control resuelto. Si al escribirlo se pierde, genera el archivo con un script de Node usando `String.fromCharCode(0x1f)` en lugar de teclearlo.

- [ ] **Step 2: Ejecutar el test para verificar que falla**

Run: `npm test -- parse-dump`
Expected: FAIL — no se resuelve `@/lib/import/parse-dump`.

- [ ] **Step 3: Escribir la implementación**

Crea `src/lib/import/parse-dump.ts`:

```ts
/**
 * Conversión de registros del Extended Streaming History a filas de `streams`.
 *
 * Módulo puro: sin red, sin base de datos, sin `server-only`. Recibe los
 * objetos ya parseados del JSON y devuelve filas listas para insertar, junto
 * con el recuento de lo que se descartó y por qué.
 *
 * Deliberadamente **no** se almacenan `ip_addr`, `conn_country`,
 * `incognito_mode` ni `offline_timestamp`. La IP es el dato más sensible del
 * paquete y ninguno de los cuatro aporta nada a unas estadísticas de escucha.
 */
import type { NewStreamRow } from "@/db/schema";
import { albumKey, artistKey, trackKey } from "@/lib/stats/normalize";
import { localParts } from "@/lib/stats/local-time";

/** Solo los campos que se leen. El dump trae más, y se ignoran a propósito. */
export type DumpRecord = {
  ts: string;
  platform?: string | null;
  ms_played: number;
  master_metadata_track_name?: string | null;
  master_metadata_album_artist_name?: string | null;
  master_metadata_album_album_name?: string | null;
  spotify_track_uri?: string | null;
  episode_name?: string | null;
  spotify_episode_uri?: string | null;
  audiobook_title?: string | null;
  audiobook_uri?: string | null;
  reason_start?: string | null;
  reason_end?: string | null;
  shuffle?: boolean | null;
  skipped?: boolean | null;
};

export type ParseResult = {
  filas: NewStreamRow[];
  /** Registros que no son música: podcasts, vídeo, audiolibros. */
  descartados: number;
  /** Subconjunto de los descartados que son audiolibros. */
  audiolibros: number;
  /** Registros con datos imposibles de interpretar. */
  invalidos: number;
  /** Rango temporal de las filas válidas, en epoch ms. */
  desde: number | null;
  hasta: number | null;
};

/** `true`/`false` a 1/0; ausente o nulo se queda en NULL. */
function booleano(v: boolean | null | undefined): number | null {
  if (v === true) return 1;
  if (v === false) return 0;
  return null;
}

export function parseDumpRecords(
  registros: DumpRecord[],
  timeZone: string,
): ParseResult {
  const filas: NewStreamRow[] = [];
  let descartados = 0;
  let audiolibros = 0;
  let invalidos = 0;
  let desde: number | null = null;
  let hasta: number | null = null;

  for (const r of registros) {
    const nombre = r.master_metadata_track_name;
    const artista = r.master_metadata_album_artist_name;

    // Sin título de canción no es música: es podcast, vídeo o audiolibro.
    if (!nombre || !artista) {
      descartados += 1;
      if (r.audiobook_title || r.audiobook_uri) audiolibros += 1;
      continue;
    }

    const ts = Date.parse(r.ts);
    if (Number.isNaN(ts)) {
      invalidos += 1;
      continue;
    }

    let local;
    try {
      local = localParts(ts, timeZone);
    } catch {
      invalidos += 1;
      continue;
    }

    const album = r.master_metadata_album_album_name ?? null;
    const uri = r.spotify_track_uri?.trim() ? r.spotify_track_uri : null;
    const claveTrack = trackKey(artista, nombre);

    filas.push({
      ts,
      msPlayed: r.ms_played ?? 0,
      trackUri: uri,
      trackName: nombre,
      artistName: artista,
      albumName: album,
      trackKey: claveTrack,
      artistKey: artistKey(artista),
      albumKey: album ? albumKey(artista, album) : null,
      localDate: local.localDate,
      localHour: local.localHour,
      reasonStart: r.reason_start ?? null,
      reasonEnd: r.reason_end ?? null,
      shuffle: booleano(r.shuffle),
      skipped: booleano(r.skipped),
      platform: r.platform ?? null,
      source: "import",
      dedupKey: `${ts}:${uri ?? claveTrack}`,
    });

    if (desde === null || ts < desde) desde = ts;
    if (hasta === null || ts > hasta) hasta = ts;
  }

  return { filas, descartados, audiolibros, invalidos, desde, hasta };
}
```

- [ ] **Step 4: Ejecutar el test para verificar que pasa**

Run: `npm test -- parse-dump`
Expected: PASS, 17 tests.

- [ ] **Step 5: Verificar los escapes en el blob committeado**

```bash
git add src/lib/import/parse-dump.ts tests/parse-dump.test.ts
git commit -m "feat: parser del Extended Streaming History"
git show HEAD:tests/parse-dump.test.ts | grep -c 'u001F'
git show HEAD:tests/parse-dump.test.ts | grep -cP '\x1f'
```

Expected: la primera cuenta devuelve 2 o más; la segunda devuelve 0.

---

## Task 2: Registro de tandas

**Files:**
- Create: `src/lib/import/batches.ts`
- Test: `tests/import-batches.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crea `tests/import-batches.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  registrarTanda,
  tandaPorHash,
  listarTandas,
} from "@/lib/import/batches";
import { createTestDb } from "./helpers/test-db";

const base = {
  filename: "Streaming_History_Audio_2019.json",
  fileHash: "abc123",
  format: "extended",
  rowsRead: 100,
  rowsInserted: 95,
  rowsSkipped: 3,
  rowsInvalid: 2,
  rangeStart: 1_500_000_000_000,
  rangeEnd: 1_600_000_000_000,
  status: "ok",
};

describe("registrarTanda", () => {
  it("guarda una tanda y le pone la fecha", async () => {
    const { db } = createTestDb();
    await registrarTanda(db, base);

    const tandas = await listarTandas(db);
    expect(tandas).toHaveLength(1);
    expect(tandas[0].filename).toBe(base.filename);
    expect(tandas[0].rowsInserted).toBe(95);
    expect(tandas[0].importedAt).toBeGreaterThan(0);
  });

  it("permite varias tandas del mismo archivo", async () => {
    // Reimportar es legítimo: la deduplicación garantiza que no duplica filas.
    const { db } = createTestDb();
    await registrarTanda(db, base);
    await registrarTanda(db, { ...base, rowsInserted: 0 });

    expect(await listarTandas(db)).toHaveLength(2);
  });

  it("las lista de más reciente a más antigua", async () => {
    const { db } = createTestDb();
    await registrarTanda(db, { ...base, filename: "primero.json" });
    await registrarTanda(db, { ...base, filename: "segundo.json" });

    const tandas = await listarTandas(db);
    expect(tandas[0].filename).toBe("segundo.json");
  });
});

describe("tandaPorHash", () => {
  it("devuelve null si el archivo nunca se importó", async () => {
    const { db } = createTestDb();
    expect(await tandaPorHash(db, "nunca-visto")).toBeNull();
  });

  it("encuentra una tanda anterior por su hash", async () => {
    const { db } = createTestDb();
    await registrarTanda(db, base);

    const previa = await tandaPorHash(db, "abc123");
    expect(previa?.filename).toBe(base.filename);
  });

  it("devuelve la más reciente si el hash se repite", async () => {
    const { db } = createTestDb();
    await registrarTanda(db, { ...base, rowsInserted: 95 });
    await registrarTanda(db, { ...base, rowsInserted: 0 });

    expect((await tandaPorHash(db, "abc123"))?.rowsInserted).toBe(0);
  });
});
```

- [ ] **Step 2: Ejecutar el test para verificar que falla**

Run: `npm test -- import-batches`
Expected: FAIL — no se resuelve `@/lib/import/batches`.

- [ ] **Step 3: Escribir la implementación**

Crea `src/lib/import/batches.ts`:

```ts
import { desc, eq } from "drizzle-orm";
import { importBatches, type ImportBatchRow } from "@/db/schema";
import type { Db } from "@/lib/stats/shared";

export type NuevaTanda = {
  filename: string;
  fileHash: string;
  format: string;
  rowsRead: number;
  rowsInserted: number;
  rowsSkipped: number;
  rowsInvalid: number;
  rangeStart: number | null;
  rangeEnd: number | null;
  status: string;
};

/**
 * Deja constancia de un archivo importado.
 *
 * No hay restricción de unicidad sobre el hash a propósito: reimportar el mismo
 * archivo es legítimo —la deduplicación por `dedup_key` impide que se dupliquen
 * filas— y el historial de intentos es información útil, no ruido.
 */
export async function registrarTanda(
  db: Db,
  tanda: NuevaTanda,
): Promise<void> {
  await db.insert(importBatches).values({
    ...tanda,
    importedAt: Date.now(),
  });
}

/** La tanda más reciente de un archivo con ese contenido, si la hubo. */
export async function tandaPorHash(
  db: Db,
  fileHash: string,
): Promise<ImportBatchRow | null> {
  const filas = await db
    .select()
    .from(importBatches)
    .where(eq(importBatches.fileHash, fileHash))
    .orderBy(desc(importBatches.importedAt), desc(importBatches.id))
    .limit(1);

  return filas[0] ?? null;
}

export async function listarTandas(db: Db): Promise<ImportBatchRow[]> {
  return db
    .select()
    .from(importBatches)
    .orderBy(desc(importBatches.importedAt), desc(importBatches.id));
}
```

- [ ] **Step 4: Ejecutar el test para verificar que pasa**

Run: `npm test -- import-batches`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/import/batches.ts tests/import-batches.test.ts
git commit -m "feat: registro de tandas de importación"
```

---

## Task 3: La regla de que el dump manda

**Files:**
- Create: `src/lib/import/dump-wins.ts`
- Test: `tests/dump-wins.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crea `tests/dump-wins.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { aplicarDumpManda } from "@/lib/import/dump-wins";
import { createTestDb } from "./helpers/test-db";
import { seedStreams, stream } from "./helpers/seed-streams";

const DIA = 86_400_000;
const T = (n: number) => 1_700_000_000_000 + n * DIA;

function contarPorFuente(sqlite: ReturnType<typeof createTestDb>["sqlite"]) {
  return Object.fromEntries(
    (
      sqlite
        .prepare("SELECT source, COUNT(*) AS n FROM streams GROUP BY source")
        .all() as { source: string; n: number }[]
    ).map((f) => [f.source, f.n]),
  );
}

describe("aplicarDumpManda", () => {
  it("no borra nada si no hay rango", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [stream({ ts: T(1), source: "live" })]);

    expect(await aplicarDumpManda(db, null, null)).toBe(0);
    expect(contarPorFuente(sqlite).live).toBe(1);
  });

  it("borra las filas live dentro del rango", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ ts: T(5), source: "live" }),
      stream({ ts: T(6), source: "live" }),
    ]);

    expect(await aplicarDumpManda(db, T(1), T(10))).toBe(2);
    expect(contarPorFuente(sqlite).live).toBeUndefined();
  });

  it("no toca las filas live posteriores al dump", async () => {
    // Lo capturado después de que Spotify generara el dump es lo único que
    // existe de ese periodo: borrarlo sería perderlo para siempre.
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ ts: T(5), source: "live" }),
      stream({ ts: T(20), source: "live" }),
    ]);

    expect(await aplicarDumpManda(db, T(1), T(10))).toBe(1);
    expect(contarPorFuente(sqlite).live).toBe(1);
  });

  it("no toca las filas live anteriores al rango", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ ts: T(1), source: "live" }),
      stream({ ts: T(5), source: "live" }),
    ]);

    expect(await aplicarDumpManda(db, T(3), T(10))).toBe(1);
    expect(contarPorFuente(sqlite).live).toBe(1);
  });

  it("incluye los extremos del rango", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ ts: T(3), source: "live" }),
      stream({ ts: T(10), source: "live" }),
    ]);

    expect(await aplicarDumpManda(db, T(3), T(10))).toBe(2);
  });

  it("nunca borra filas importadas", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ ts: T(5), source: "import" }),
      stream({ ts: T(6), source: "live" }),
    ]);

    expect(await aplicarDumpManda(db, T(1), T(10))).toBe(1);
    expect(contarPorFuente(sqlite).import).toBe(1);
  });

  it("deja la tabla intacta si no hay ninguna fila live", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [stream({ ts: T(5), source: "import" })]);

    expect(await aplicarDumpManda(db, T(1), T(10))).toBe(0);
    expect(
      (sqlite.prepare("SELECT COUNT(*) AS n FROM streams").get() as { n: number })
        .n,
    ).toBe(1);
  });
});
```

- [ ] **Step 2: Ejecutar el test para verificar que falla**

Run: `npm test -- dump-wins`
Expected: FAIL — no se resuelve `@/lib/import/dump-wins`.

- [ ] **Step 3: Escribir la implementación**

Crea `src/lib/import/dump-wins.ts`:

```ts
import { and, eq, gte, lte } from "drizzle-orm";
import { streams } from "@/db/schema";
import type { Db } from "@/lib/stats/shared";

/**
 * El dump manda en su propio rango (decisión D2 del documento de diseño).
 *
 * Las filas capturadas en vivo dentro del periodo que cubre el dump se borran y
 * las sustituyen las importadas, que traen `ms_played` real y `skipped` en vez
 * de aproximaciones. Las posteriores al dump sobreviven: son lo único que
 * existe de ese periodo.
 *
 * Resolver el solapamiento así, por decreto, evita tener que deduplicar entre
 * fuentes con heurísticas de coincidencia difusa que nunca son del todo fiables.
 *
 * Se llama **al terminar toda la tanda**, no archivo a archivo: si el import
 * falla a la mitad, no se pierden a la vez lo capturado y lo importado.
 *
 * Devuelve cuántas filas se borraron.
 */
export async function aplicarDumpManda(
  db: Db,
  desde: number | null,
  hasta: number | null,
): Promise<number> {
  if (desde === null || hasta === null) return 0;

  const borradas = await db
    .delete(streams)
    .where(
      and(
        eq(streams.source, "live"),
        gte(streams.ts, desde),
        lte(streams.ts, hasta),
      ),
    )
    .returning({ id: streams.id });

  return borradas.length;
}
```

- [ ] **Step 4: Ejecutar el test para verificar que pasa**

Run: `npm test -- dump-wins`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/import/dump-wins.ts tests/dump-wins.test.ts
git commit -m "feat: regla del dump manda en su propio rango"
```

---

## Task 4: Server actions de importación

**Files:**
- Create: `src/lib/import/import-actions.ts`
- Modify: `.gitignore`

Este es el punto donde el código toca el disco y la base real. No lleva tests unitarios: cada función es una capa fina sobre piezas ya probadas, y probarla exigiría montar un sistema de archivos falso para verificar poco. Se valida ejecutándola de verdad en la Task 6.

- [ ] **Step 1: Asegurar que los archivos del dump no entran en git**

`data/` ya está ignorado (`.gitignore:45`), y `data/import/` cae dentro. Verifícalo antes de seguir:

```bash
mkdir -p data/import
touch data/import/prueba.json
git check-ignore -v data/import/prueba.json
rm data/import/prueba.json
```

Expected: git responde que la regla `data/` lo ignora. Si no lo hiciera, **para y reporta**: el historial de escucha del usuario no puede acabar en un repositorio.

- [ ] **Step 2: Escribir las acciones**

Crea `src/lib/import/import-actions.ts`:

```ts
"use server";

import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requireSession } from "@/lib/require-session";
import { insertStreams } from "@/lib/streams";
import { resolveTimeZone } from "@/lib/stats/local-time";
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

  const disponibles = await fs.readdir(DIRECTORIO).catch(() => []);
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
```

- [ ] **Step 3: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/lib/import/import-actions.ts
git commit -m "feat: acciones de listado e importación de archivos del dump"
```

---

## Task 5: Panel de importación

**Files:**
- Create: `src/components/ImportPanel.tsx`
- Modify: `src/app/ajustes/page.tsx`

- [ ] **Step 1: Escribir el componente**

Crea `src/components/ImportPanel.tsx`:

```tsx
"use client";

import { useState } from "react";
import {
  importarArchivo,
  cerrarImportacion,
  type ArchivoDisponible,
  type ResultadoArchivo,
} from "@/lib/import/import-actions";

/**
 * Importa los archivos de uno en uno desde el cliente.
 *
 * Un solo `await` para veintidós archivos y trescientos mil registros sería una
 * petición de varios minutos, expuesta a cualquier timeout intermedio y sin
 * forma de saber por dónde iba. Recorriendo la lista se ve el avance y, si algo
 * falla, se sabe exactamente en qué archivo.
 */
export default function ImportPanel({
  archivos,
}: {
  archivos: ArchivoDisponible[];
}) {
  const [corriendo, setCorriendo] = useState(false);
  const [hechos, setHechos] = useState<ResultadoArchivo[]>([]);
  const [cierre, setCierre] = useState<string | null>(null);

  const importar = async () => {
    setCorriendo(true);
    setHechos([]);
    setCierre(null);

    const resultados: ResultadoArchivo[] = [];
    let desde: number | null = null;
    let hasta: number | null = null;

    for (const a of archivos) {
      const r = await importarArchivo(a.nombre);
      resultados.push(r);
      setHechos([...resultados]);

      if (r.desde !== null && (desde === null || r.desde < desde)) desde = r.desde;
      if (r.hasta !== null && (hasta === null || r.hasta > hasta)) hasta = r.hasta;
    }

    const { borradas } = await cerrarImportacion(desde, hasta);
    setCierre(
      borradas > 0
        ? `${borradas} escuchas capturadas se sustituyeron por las del dump.`
        : "No hubo solapamiento con lo capturado.",
    );
    setCorriendo(false);
  };

  const totalInsertadas = hechos.reduce((n, r) => n + r.insertados, 0);
  const conError = hechos.filter((r) => r.error);

  return (
    <section className="hairline-b px-8 py-10">
      <p className="label-mono text-mute mb-6">Importar historial</p>

      {archivos.length === 0 ? (
        <p className="font-serif italic text-cream-dim max-w-lg">
          No hay archivos en <span className="font-mono not-italic">data/import</span>.
          Descomprime ahí el <em>Extended Streaming History</em> que te envió
          Spotify — los archivos que empiezan por{" "}
          <span className="font-mono not-italic">Streaming_History_Audio</span>.
        </p>
      ) : (
        <>
          <p className="font-serif italic text-cream-dim mb-6">
            {archivos.length} archivos listos.{" "}
            {archivos.some((a) => a.importadoAntes) && (
              <>Alguno ya se importó antes; volver a hacerlo no duplica nada.</>
            )}
          </p>

          <button
            type="button"
            onClick={importar}
            disabled={corriendo}
            className="label-mono border border-current px-4 py-2 disabled:opacity-50"
          >
            {corriendo
              ? `Importando… ${hechos.length}/${archivos.length}`
              : "Importar todo"}
          </button>

          {hechos.length > 0 && (
            <div className="mt-8">
              <p className="label-mono text-mute mb-3">
                {totalInsertadas.toLocaleString("es")} escuchas nuevas
              </p>

              <ul className="max-h-64 overflow-y-auto">
                {hechos.map((r) => (
                  <li
                    key={r.nombre}
                    className="flex items-baseline justify-between gap-4 py-1.5 hairline-b"
                  >
                    <span className="font-mono text-xs truncate">{r.nombre}</span>
                    <span
                      className={`label-mono num-tabular whitespace-nowrap ${
                        r.error ? "text-blood" : "text-mute"
                      }`}
                    >
                      {r.error ?? `+${r.insertados.toLocaleString("es")}`}
                    </span>
                  </li>
                ))}
              </ul>

              {conError.length > 0 && (
                <p className="label-mono text-blood mt-4">
                  {conError.length} archivos fallaron.
                </p>
              )}

              {cierre && (
                <p className="label-mono text-acid mt-4">{cierre}</p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Añadirlo a la página de ajustes**

En `src/app/ajustes/page.tsx`, añade los imports:

```tsx
import ImportPanel from "@/components/ImportPanel";
import { listarArchivos } from "@/lib/import/import-actions";
```

Añade `listarArchivos()` a la llamada `Promise.all` existente, y renderiza el panel justo después de `<CaptureHealth ... />`:

```tsx
      <ImportPanel archivos={archivos} />
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: sin errores, toda la suite en verde.

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/ajustes
```

Expected: una redirección sin sesión, que confirma que compila.

- [ ] **Step 4: Commit**

```bash
git add src/components/ImportPanel.tsx src/app/ajustes/page.tsx
git commit -m "feat: panel de importación en /ajustes"
```

---

## Task 6: La importación de verdad

Esta tarea no escribe código. Ejecuta la importación real contra la base del usuario, con sus 277.941 registros.

**Files:** ninguno

- [ ] **Step 1: Colocar los archivos**

```bash
mkdir -p data/import
cd data/import && unzip -o -j "C:/Users/USUARIO/Downloads/my_spotify_data.zip" "Spotify Extended Streaming History/Streaming_History_Audio_*.json"
ls -1 | wc -l
```

Expected: 22 archivos. `-j` aplana la estructura de carpetas; solo se extraen los de audio, no los de vídeo ni el PDF.

- [ ] **Step 2: Anotar el estado previo**

```bash
node -e "const D=require('better-sqlite3');const d=new D('data/ledger.db',{readonly:true});console.log('antes:',d.prepare('SELECT source, COUNT(*) n FROM streams GROUP BY source').all())"
```

Anota el número. Debería mostrar solo filas `live`.

- [ ] **Step 3: Importar**

Abre `http://127.0.0.1:3000/ajustes` con sesión iniciada y pulsa **Importar todo**. Tarda un rato: son 210 MB de JSON y casi trescientas mil filas.

- [ ] **Step 4: Verificar el resultado**

```bash
node -e "
const D=require('better-sqlite3');const d=new D('data/ledger.db',{readonly:true});
console.log('por fuente:', d.prepare('SELECT source, COUNT(*) n FROM streams GROUP BY source').all());
console.log('rango:', d.prepare('SELECT MIN(local_date) a, MAX(local_date) b FROM streams').get());
console.log('artistas:', d.prepare('SELECT COUNT(DISTINCT artist_key) n FROM streams').get().n);
console.log('horas:', Math.round(d.prepare('SELECT SUM(ms_played) s FROM streams').get().s/3600000));
console.log('tandas:', d.prepare('SELECT COUNT(*) n FROM import_batches').get().n);
console.log('sin IP:', d.prepare(\"SELECT COUNT(*) n FROM pragma_table_info('streams') WHERE name LIKE '%ip%'\").get().n === 0);
"
```

Expected, contrastado con el análisis del dump: unas 277.580 filas `import`, rango desde 2018-09 hasta hoy, en torno a 10.674 artistas, unas 6.934 horas, 22 tandas, y ninguna columna de IP.

- [ ] **Step 5: Comprobar que la deduplicación funciona**

Pulsa **Importar todo** otra vez y vuelve a contar.

Expected: el mismo número de filas. Cada archivo reportará `+0`.

- [ ] **Step 6: Mirar la portada**

Abre `http://127.0.0.1:3000` y prueba los presets. Con el histórico seleccionado deberían verse ocho años en el gráfico mensual.

- [ ] **Step 7: Retirar los archivos**

```bash
rm -rf data/import
```

Ya están en la base. Son 210 MB de JSON con la IP del usuario en cada línea, y no hay motivo para conservarlos en el proyecto.

---

## Verificación final

- [ ] `npm test` — toda la suite en verde
- [ ] `npx tsc --noEmit && npm run lint` — limpios
- [ ] `npm run build` — compila
- [ ] `/ajustes` sigue mostrando la captura sana y la tarea programada corriendo
- [ ] La portada muestra ocho años de datos
- [ ] `data/import` ya no existe

---

## Qué queda después

- **`skips.ts`** — ahora sí hay datos con los que calcular el abandono: el dump trae `skipped` y `reason_end` reales.
- **Mapa de calor de calendario** — con ~2.900 días de historial pasa a tener sentido.
- **Fichas de canción y álbum** — misma forma que la de artista.
- **Fase 6** — tarjetas para compartir y playlists desde los tops.
