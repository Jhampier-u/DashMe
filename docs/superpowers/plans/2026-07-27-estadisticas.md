# Estadísticas de escucha — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir las escuchas que ya se están capturando en cifras visibles — tops, minutos, rachas, histogramas y fichas por artista — sobre cualquier rango de fechas.

**Architecture:** Un módulo por familia de consultas en `src/lib/stats/`, cada uno con una responsabilidad y testeable contra una base SQLite en memoria. Todas las funciones reciben la base como argumento y filtran por `local_date`, nunca por `ts`. Una portada las consume y el rango vive en la URL.

**Tech Stack:** Next.js 16 (App Router), TypeScript, SQLite vía better-sqlite3 + Drizzle ORM, Vitest.

**Diseño de referencia:** [`docs/superpowers/specs/2026-07-27-voidtify-estadisticas-escucha-design.md`](../specs/2026-07-27-voidtify-estadisticas-escucha-design.md), sección 6.4 y decisión D9.

**Rama:** `feat/estadisticas-escucha`

---

## Estado de partida

La Fase 2 está completa y en marcha:

- La tabla `streams` tiene filas reales y crece cada 20 minutos vía la tarea programada.
- `src/lib/stats/range.ts` produce `StatsRange` con `fromDate`/`toDate` como fechas locales inclusivas (`YYYY-MM-DD`).
- `src/lib/stats/normalize.ts` y `local-time.ts` son módulos puros ya probados.
- `tests/helpers/test-db.ts` construye una base en memoria con el esquema exacto de producción.
- 78 tests en verde; `npx tsc --noEmit` y `npm run lint` limpios.

**`src/db/index.ts` abre y escribe `data/ledger.db` al importarse.** Esa es la base real del usuario, con sus escuchas y su refresh token. Ningún test puede importarla. Por eso todas las funciones de este plan reciben la base como parámetro — el mismo patrón que `insertStreams` en `src/lib/streams.ts:20`.

---

## Estructura de archivos

**Se crean:**

| Archivo | Responsabilidad |
|---|---|
| `src/lib/stats/shared.ts` | Tipo `Db`, `Metric`, el umbral de reproducción contada y el filtro de rango |
| `src/lib/stats/totals.ts` | Minutos, reproducciones, días activos, entidades distintas |
| `src/lib/stats/tops.ts` | Top artistas, canciones y álbumes |
| `src/lib/stats/time.ts` | Agregación por hora del día, día de la semana y mes |
| `src/lib/stats/streaks.ts` | Racha actual y racha más larga |
| `src/lib/stats/detail.ts` | Ficha de un artista: veces, primera y última vez, posición |
| `src/lib/stats/history.ts` | Historial paginado con búsqueda |
| `tests/helpers/seed-streams.ts` | Constructor de filas de prueba |
| `src/components/stats/*` | Componentes de presentación de la portada |

**Se modifican:**

| Archivo | Cambio |
|---|---|
| `src/app/page.tsx` | Pasa de índice de playlists a portada de estadísticas |
| `src/app/biblioteca/page.tsx` | Recibe el índice de playlists que hoy vive en `/` |
| `src/components/TopBar.tsx` | Navegación nueva |

**Fuera de este plan, deliberadamente:**

- **`skips.ts`** — la tasa de abandono solo tiene sentido sobre filas `source='import'`, y todavía no existe ninguna. Las filas `live` llevan `skipped` a `NULL` por diseño. Se planifica cuando llegue el dump.
- **`genres.ts`** — depende de resolver nombres a IDs de Spotify vía `artist_resolution` y consultar Last.fm con caché. Es un subsistema propio, no una consulta más.
- **Fichas de canción y álbum** — `detail.ts` cubre artistas. Las otras dos son la misma forma con otra columna de agrupación; se añaden cuando la de artista esté validada contra datos reales.

---

## Convenciones que aplican a todas las tareas

**Firma.** Toda función exportada recibe la base primero:

```ts
export async function loQueSea(db: Db, range: StatsRange, ...): Promise<...>
```

**Filtro de rango.** Siempre `local_date BETWEEN :fromDate AND :toDate`, nunca `ts`. Es la decisión D9: los límites son días locales, el índice `streams_local_date_idx` existe, y comparar `YYYY-MM-DD` como texto ordena igual que cronológicamente.

**Umbral.** Una "reproducción contada" es `ms_played >= 30000`, el mismo criterio que usa Spotify. Se aplica a los conteos de reproducciones y a los rankings. **No** se aplica a la suma de minutos: si sonaron 12 segundos, esos 12 segundos se escucharon.

**SQL crudo mediante `sql` de Drizzle** para las agregaciones. El constructor de consultas de Drizzle no aporta nada en un `GROUP BY` con agregados y hace el resultado más difícil de leer.

---

## Task 1: Cimientos compartidos y sembrado de pruebas

**Files:**
- Create: `src/lib/stats/shared.ts`
- Create: `tests/helpers/seed-streams.ts`
- Test: `tests/stats-shared.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crea `tests/stats-shared.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { MS_MINIMO_CONTADO, enRango } from "@/lib/stats/shared";
import { createTestDb } from "./helpers/test-db";
import { seedStreams, stream } from "./helpers/seed-streams";

describe("MS_MINIMO_CONTADO", () => {
  it("son 30 segundos, el umbral de Spotify", () => {
    expect(MS_MINIMO_CONTADO).toBe(30_000);
  });
});

describe("enRango", () => {
  it("incluye los dos extremos", () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: "2026-02-28" }),
      stream({ localDate: "2026-03-01" }),
      stream({ localDate: "2026-03-15" }),
      stream({ localDate: "2026-03-31" }),
      stream({ localDate: "2026-04-01" }),
    ]);

    const filtro = enRango({
      fromDate: "2026-03-01",
      toDate: "2026-03-31",
      label: "",
      preset: "custom",
    });

    const filas = db.all<{ n: number }>(
      sql`SELECT COUNT(*) AS n FROM streams WHERE ${filtro}`,
    );
    expect(filas[0].n).toBe(3);
  });

  it("cruza el cambio de año sin problemas", () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: "2025-12-31" }),
      stream({ localDate: "2026-01-01" }),
    ]);

    const filtro = enRango({
      fromDate: "2025-12-01",
      toDate: "2026-01-31",
      label: "",
      preset: "custom",
    });

    const filas = db.all<{ n: number }>(
      sql`SELECT COUNT(*) AS n FROM streams WHERE ${filtro}`,
    );
    expect(filas[0].n).toBe(2);
  });
});

describe("seedStreams", () => {
  it("inserta las filas que se le dan", () => {
    const { sqlite } = createTestDb();
    seedStreams(sqlite, [stream({}), stream({}), stream({})]);
    const n = sqlite.prepare("SELECT COUNT(*) AS n FROM streams").get() as {
      n: number;
    };
    expect(n.n).toBe(3);
  });

  it("genera dedup_key únicos sin que haya que darlos", () => {
    const { sqlite } = createTestDb();
    expect(() =>
      seedStreams(sqlite, [stream({}), stream({}), stream({})]),
    ).not.toThrow();
  });

  it("respeta los valores que se le pasan", () => {
    const { sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ artistName: "Duster", msPlayed: 12345, localHour: 3 }),
    ]);
    const f = sqlite
      .prepare("SELECT artist_name, ms_played, local_hour FROM streams")
      .get() as { artist_name: string; ms_played: number; local_hour: number };
    expect(f.artist_name).toBe("Duster");
    expect(f.ms_played).toBe(12345);
    expect(f.local_hour).toBe(3);
  });

  it("deriva las claves normalizadas del nombre", () => {
    const { sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ artistName: "Beyoncé", trackName: "Halo" }),
    ]);
    const f = sqlite
      .prepare("SELECT artist_key, track_key FROM streams")
      .get() as { artist_key: string; track_key: string };
    expect(f.artist_key).toBe("beyonce");
    expect(f.track_key).toBe("beyoncehalo");
  });
});
```

- [ ] **Step 2: Ejecutar el test para verificar que falla**

Run: `npm test -- stats-shared`
Expected: FAIL — no se resuelve `@/lib/stats/shared`.

- [ ] **Step 3: Escribir `shared.ts`**

Crea `src/lib/stats/shared.ts`:

```ts
import { sql, type SQL } from "drizzle-orm";
import { streams } from "@/db/schema";
import type { db as ProductionDb } from "@/db";
import type { StatsRange } from "./range";

/**
 * La base se pasa como argumento en vez de importar el singleton de `@/db`.
 *
 * `src/db/index.ts` abre y escribe el archivo real al importarse, así que un
 * test que lo tocara escribiría en los datos del usuario. Mismo patrón que
 * `insertStreams` en `src/lib/streams.ts`.
 */
export type Db = typeof ProductionDb;

/**
 * Umbral de "reproducción contada": el mismo que usa Spotify.
 *
 * Se aplica a los conteos de reproducciones y a los rankings, pero **no** a la
 * suma de minutos — si algo sonó doce segundos, esos doce segundos se
 * escucharon y cuentan como tiempo.
 */
export const MS_MINIMO_CONTADO = 30_000;

/** Por qué se ordena un ranking. */
export type Metric = "plays" | "ms";

/**
 * Filtro de rango sobre `local_date`.
 *
 * Nunca sobre `ts`: los límites del rango son días locales del usuario, y
 * comparar epochs UTC desplazaría cada extremo tantas horas como diga su zona
 * horaria (ver D9 en el documento de diseño). El formato `YYYY-MM-DD` ordena
 * lexicográficamente igual que cronológicamente, y `streams_local_date_idx`
 * hace que la comparación use índice.
 */
export function enRango(range: StatsRange): SQL {
  return sql`${streams.localDate} BETWEEN ${range.fromDate} AND ${range.toDate}`;
}

/** Filtro adicional para contar solo reproducciones que superaron el umbral. */
export function contadas(): SQL {
  return sql`${streams.msPlayed} >= ${MS_MINIMO_CONTADO}`;
}
```

- [ ] **Step 4: Escribir el sembrador de pruebas**

Crea `tests/helpers/seed-streams.ts`:

```ts
import type Database from "better-sqlite3";
import { artistKey, albumKey, trackKey } from "@/lib/stats/normalize";

/**
 * Constructor de filas de `streams` para tests.
 *
 * Todo tiene un valor por defecto razonable y `dedup_key` se genera solo, para
 * que cada test declare únicamente lo que le importa. Sin esto, cada caso
 * tendría que repetir diecinueve columnas y lo relevante quedaría escondido.
 */
export type SeedStream = {
  ts?: number;
  msPlayed?: number;
  trackUri?: string | null;
  trackName?: string;
  artistName?: string;
  albumName?: string | null;
  localDate?: string;
  localHour?: number;
  skipped?: number | null;
  source?: string;
};

let contador = 0;

export function stream(over: SeedStream = {}): Required<SeedStream> {
  contador += 1;
  return {
    ts: over.ts ?? 1_700_000_000_000 + contador * 1000,
    msPlayed: over.msPlayed ?? 210_000,
    trackUri: over.trackUri ?? `spotify:track:seed${contador}`,
    trackName: over.trackName ?? "Alison",
    artistName: over.artistName ?? "Slowdive",
    albumName: over.albumName ?? "Souvlaki",
    localDate: over.localDate ?? "2026-03-15",
    localHour: over.localHour ?? 15,
    skipped: over.skipped ?? null,
    source: over.source ?? "live",
  };
}

export function seedStreams(
  sqlite: Database.Database,
  filas: Required<SeedStream>[],
): void {
  const insertar = sqlite.prepare(`
    INSERT INTO streams
      (ts, ms_played, track_uri, track_name, artist_name, album_name,
       track_key, artist_key, album_key, local_date, local_hour,
       skipped, source, dedup_key)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const tx = sqlite.transaction((rows: Required<SeedStream>[]) => {
    for (const f of rows) {
      insertar.run(
        f.ts,
        f.msPlayed,
        f.trackUri,
        f.trackName,
        f.artistName,
        f.albumName,
        trackKey(f.artistName, f.trackName),
        artistKey(f.artistName),
        f.albumName ? albumKey(f.artistName, f.albumName) : null,
        f.localDate,
        f.localHour,
        f.skipped,
        f.source,
        `${f.ts}:${f.trackUri ?? trackKey(f.artistName, f.trackName)}`,
      );
    }
  });

  tx(filas);
}
```

- [ ] **Step 5: Ejecutar el test para verificar que pasa**

Run: `npm test -- stats-shared`
Expected: PASS, 7 tests.

- [ ] **Step 6: Verificar todo y commitear**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: sin errores, 85 tests (78 + 7).

```bash
git add src/lib/stats/shared.ts tests/helpers/seed-streams.ts tests/stats-shared.test.ts
git commit -m "feat: cimientos compartidos de estadísticas y sembrador de pruebas"
```

---

## Task 2: Totales

**Files:**
- Create: `src/lib/stats/totals.ts`
- Test: `tests/stats-totals.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crea `tests/stats-totals.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getTotals } from "@/lib/stats/totals";
import type { StatsRange } from "@/lib/stats/range";
import { createTestDb } from "./helpers/test-db";
import { seedStreams, stream } from "./helpers/seed-streams";

const MARZO: StatsRange = {
  fromDate: "2026-03-01",
  toDate: "2026-03-31",
  label: "Marzo",
  preset: "custom",
};

describe("getTotals", () => {
  it("devuelve ceros cuando no hay nada en el rango", async () => {
    const { db } = createTestDb();
    const t = await getTotals(db, MARZO);

    expect(t).toEqual({
      msTotal: 0,
      reproducciones: 0,
      diasActivos: 0,
      artistas: 0,
      canciones: 0,
      albumes: 0,
    });
  });

  it("suma los milisegundos de todas las filas del rango", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: "2026-03-10", msPlayed: 200_000 }),
      stream({ localDate: "2026-03-11", msPlayed: 100_000 }),
    ]);

    expect((await getTotals(db, MARZO)).msTotal).toBe(300_000);
  });

  it("incluye en los minutos las reproducciones cortas", async () => {
    // Doce segundos escuchados son doce segundos, aunque no cuenten como
    // reproducción para el ranking.
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: "2026-03-10", msPlayed: 12_000 }),
    ]);

    const t = await getTotals(db, MARZO);
    expect(t.msTotal).toBe(12_000);
    expect(t.reproducciones).toBe(0);
  });

  it("cuenta como reproducción solo lo que supera 30 segundos", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: "2026-03-10", msPlayed: 29_999 }),
      stream({ localDate: "2026-03-10", msPlayed: 30_000 }),
      stream({ localDate: "2026-03-10", msPlayed: 200_000 }),
    ]);

    expect((await getTotals(db, MARZO)).reproducciones).toBe(2);
  });

  it("cuenta días activos distintos, no filas", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: "2026-03-10" }),
      stream({ localDate: "2026-03-10" }),
      stream({ localDate: "2026-03-10" }),
      stream({ localDate: "2026-03-11" }),
    ]);

    expect((await getTotals(db, MARZO)).diasActivos).toBe(2);
  });

  it("cuenta entidades distintas por clave normalizada", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: "2026-03-10", artistName: "Slowdive", trackName: "Alison", albumName: "Souvlaki" }),
      stream({ localDate: "2026-03-10", artistName: "slowdive", trackName: "alison", albumName: "souvlaki" }),
      stream({ localDate: "2026-03-10", artistName: "Duster", trackName: "Inside Out", albumName: "Stratosphere" }),
    ]);

    const t = await getTotals(db, MARZO);
    expect(t.artistas).toBe(2);
    expect(t.canciones).toBe(2);
    expect(t.albumes).toBe(2);
  });

  it("excluye lo que cae fuera del rango", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: "2026-02-28", msPlayed: 999_999 }),
      stream({ localDate: "2026-04-01", msPlayed: 999_999 }),
      stream({ localDate: "2026-03-15", msPlayed: 100_000 }),
    ]);

    expect((await getTotals(db, MARZO)).msTotal).toBe(100_000);
  });

  it("no cuenta álbumes nulos", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: "2026-03-10", albumName: null }),
    ]);

    expect((await getTotals(db, MARZO)).albumes).toBe(0);
  });
});
```

- [ ] **Step 2: Ejecutar el test para verificar que falla**

Run: `npm test -- stats-totals`
Expected: FAIL — no se resuelve `@/lib/stats/totals`.

- [ ] **Step 3: Escribir la implementación**

Crea `src/lib/stats/totals.ts`:

```ts
import { sql } from "drizzle-orm";
import { streams } from "@/db/schema";
import type { StatsRange } from "./range";
import { MS_MINIMO_CONTADO, enRango, type Db } from "./shared";

export type Totals = {
  /** Suma de `ms_played` de todas las filas, incluidas las cortas. */
  msTotal: number;
  /** Filas que superaron el umbral de reproducción contada. */
  reproducciones: number;
  /** Días locales distintos con al menos una escucha. */
  diasActivos: number;
  artistas: number;
  canciones: number;
  albumes: number;
};

export async function getTotals(
  db: Db,
  range: StatsRange,
): Promise<Totals> {
  const filas = db.all<{
    ms_total: number | null;
    reproducciones: number;
    dias_activos: number;
    artistas: number;
    canciones: number;
    albumes: number;
  }>(sql`
    SELECT
      SUM(${streams.msPlayed})                                        AS ms_total,
      SUM(CASE WHEN ${streams.msPlayed} >= ${MS_MINIMO_CONTADO}
               THEN 1 ELSE 0 END)                                     AS reproducciones,
      COUNT(DISTINCT ${streams.localDate})                            AS dias_activos,
      COUNT(DISTINCT ${streams.artistKey})                            AS artistas,
      COUNT(DISTINCT ${streams.trackKey})                             AS canciones,
      COUNT(DISTINCT ${streams.albumKey})                             AS albumes
    FROM ${streams}
    WHERE ${enRango(range)}
  `);

  const f = filas[0];

  return {
    // SUM sobre cero filas devuelve NULL, no 0.
    msTotal: f?.ms_total ?? 0,
    reproducciones: f?.reproducciones ?? 0,
    diasActivos: f?.dias_activos ?? 0,
    artistas: f?.artistas ?? 0,
    canciones: f?.canciones ?? 0,
    albumes: f?.albumes ?? 0,
  };
}
```

Nota: `COUNT(DISTINCT col)` ignora los `NULL` por definición de SQL, que es justo lo que hace pasar el test de los álbumes nulos.

- [ ] **Step 4: Ejecutar el test para verificar que pasa**

Run: `npm test -- stats-totals`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stats/totals.ts tests/stats-totals.test.ts
git commit -m "feat: totales de escucha por rango"
```

---

## Task 3: Rankings

**Files:**
- Create: `src/lib/stats/tops.ts`
- Test: `tests/stats-tops.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crea `tests/stats-tops.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getTopArtists, getTopTracks, getTopAlbums } from "@/lib/stats/tops";
import type { StatsRange } from "@/lib/stats/range";
import { createTestDb } from "./helpers/test-db";
import { seedStreams, stream } from "./helpers/seed-streams";

const MARZO: StatsRange = {
  fromDate: "2026-03-01",
  toDate: "2026-03-31",
  label: "Marzo",
  preset: "custom",
};

const d = "2026-03-10";

describe("getTopArtists", () => {
  it("devuelve lista vacía sin datos", async () => {
    const { db } = createTestDb();
    expect(await getTopArtists(db, MARZO)).toEqual([]);
  });

  it("ordena por reproducciones de mayor a menor", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: d, artistName: "Duster" }),
      stream({ localDate: d, artistName: "Duster" }),
      stream({ localDate: d, artistName: "Duster" }),
      stream({ localDate: d, artistName: "Slowdive" }),
      stream({ localDate: d, artistName: "Slowdive" }),
      stream({ localDate: d, artistName: "Grouper" }),
    ]);

    const top = await getTopArtists(db, MARZO);
    expect(top.map((a) => a.name)).toEqual(["Duster", "Slowdive", "Grouper"]);
    expect(top.map((a) => a.plays)).toEqual([3, 2, 1]);
  });

  it("agrupa variantes del mismo nombre", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: d, artistName: "Beyoncé" }),
      stream({ localDate: d, artistName: "beyonce" }),
    ]);

    const top = await getTopArtists(db, MARZO);
    expect(top).toHaveLength(1);
    expect(top[0].plays).toBe(2);
  });

  it("devuelve también los milisegundos de cada uno", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: d, artistName: "Duster", msPlayed: 100_000 }),
      stream({ localDate: d, artistName: "Duster", msPlayed: 50_000 }),
    ]);

    expect((await getTopArtists(db, MARZO))[0].ms).toBe(150_000);
  });

  it("puede ordenar por tiempo en vez de por reproducciones", async () => {
    // Un artista de temas largos pierde por reproducciones y gana por tiempo.
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: d, artistName: "Godspeed", msPlayed: 1_200_000 }),
      stream({ localDate: d, artistName: "Ramones", msPlayed: 90_000 }),
      stream({ localDate: d, artistName: "Ramones", msPlayed: 90_000 }),
    ]);

    expect((await getTopArtists(db, MARZO, "plays"))[0].name).toBe("Ramones");
    expect((await getTopArtists(db, MARZO, "ms"))[0].name).toBe("Godspeed");
  });

  it("ignora reproducciones por debajo del umbral", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: d, artistName: "Duster", msPlayed: 5_000 }),
      stream({ localDate: d, artistName: "Slowdive", msPlayed: 200_000 }),
    ]);

    const top = await getTopArtists(db, MARZO);
    expect(top).toHaveLength(1);
    expect(top[0].name).toBe("Slowdive");
  });

  it("respeta el límite", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(
      sqlite,
      Array.from({ length: 30 }, (_, i) =>
        stream({ localDate: d, artistName: `Artista ${i}` }),
      ),
    );

    expect(await getTopArtists(db, MARZO, "plays", 10)).toHaveLength(10);
  });

  it("muestra el nombre tal como se escribió, no la clave", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: d, artistName: "Sigur Rós" }),
    ]);

    expect((await getTopArtists(db, MARZO))[0].name).toBe("Sigur Rós");
  });

  it("excluye lo que cae fuera del rango", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: "2026-02-01", artistName: "Fuera" }),
      stream({ localDate: d, artistName: "Dentro" }),
    ]);

    const top = await getTopArtists(db, MARZO);
    expect(top.map((a) => a.name)).toEqual(["Dentro"]);
  });
});

describe("getTopTracks", () => {
  it("agrupa por canción, no por artista", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: d, artistName: "Duster", trackName: "Inside Out" }),
      stream({ localDate: d, artistName: "Duster", trackName: "Inside Out" }),
      stream({ localDate: d, artistName: "Duster", trackName: "Gold Dust" }),
    ]);

    const top = await getTopTracks(db, MARZO);
    expect(top).toHaveLength(2);
    expect(top[0].name).toBe("Inside Out");
    expect(top[0].plays).toBe(2);
  });

  it("incluye el artista de cada canción", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: d, artistName: "Duster", trackName: "Inside Out" }),
    ]);

    expect((await getTopTracks(db, MARZO))[0].artistName).toBe("Duster");
  });

  it("distingue canciones con el mismo título de artistas distintos", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: d, artistName: "Duster", trackName: "Constellations" }),
      stream({ localDate: d, artistName: "Jack Johnson", trackName: "Constellations" }),
    ]);

    expect(await getTopTracks(db, MARZO)).toHaveLength(2);
  });
});

describe("getTopAlbums", () => {
  it("agrupa por álbum e incluye el artista", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: d, artistName: "Duster", albumName: "Stratosphere" }),
      stream({ localDate: d, artistName: "Duster", albumName: "Stratosphere" }),
      stream({ localDate: d, artistName: "Duster", albumName: "Contemporary Movement" }),
    ]);

    const top = await getTopAlbums(db, MARZO);
    expect(top).toHaveLength(2);
    expect(top[0].name).toBe("Stratosphere");
    expect(top[0].artistName).toBe("Duster");
  });

  it("ignora filas sin álbum", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: d, albumName: null }),
      stream({ localDate: d, albumName: "Souvlaki" }),
    ]);

    expect(await getTopAlbums(db, MARZO)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Ejecutar el test para verificar que falla**

Run: `npm test -- stats-tops`
Expected: FAIL — no se resuelve `@/lib/stats/tops`.

- [ ] **Step 3: Escribir la implementación**

Crea `src/lib/stats/tops.ts`:

```ts
import { sql } from "drizzle-orm";
import { streams } from "@/db/schema";
import type { StatsRange } from "./range";
import { contadas, enRango, type Db, type Metric } from "./shared";

export type TopEntry = {
  /** Clave normalizada — para enlazar a la ficha. */
  key: string;
  /** Nombre tal como aparece en los datos. */
  name: string;
  plays: number;
  ms: number;
};

export type TopTrackEntry = TopEntry & { artistName: string };
export type TopAlbumEntry = TopEntry & { artistName: string };

const LIMITE_POR_DEFECTO = 50;

/**
 * `MAX(name)` en lugar de un `GROUP BY` sobre el nombre: se agrupa por la clave
 * normalizada, así que dentro de un grupo puede haber varias grafías del mismo
 * nombre. Se muestra una cualquiera de ellas — la alternativa sería elegir la
 * más frecuente, que cuesta una subconsulta y no aporta nada perceptible.
 */
function ordenPor(metric: Metric) {
  return metric === "ms" ? sql`ms DESC, plays DESC` : sql`plays DESC, ms DESC`;
}

export async function getTopArtists(
  db: Db,
  range: StatsRange,
  metric: Metric = "plays",
  limite = LIMITE_POR_DEFECTO,
): Promise<TopEntry[]> {
  return db.all<TopEntry>(sql`
    SELECT
      ${streams.artistKey}          AS key,
      MAX(${streams.artistName})    AS name,
      COUNT(*)                      AS plays,
      SUM(${streams.msPlayed})      AS ms
    FROM ${streams}
    WHERE ${enRango(range)} AND ${contadas()}
    GROUP BY ${streams.artistKey}
    ORDER BY ${ordenPor(metric)}
    LIMIT ${limite}
  `);
}

export async function getTopTracks(
  db: Db,
  range: StatsRange,
  metric: Metric = "plays",
  limite = LIMITE_POR_DEFECTO,
): Promise<TopTrackEntry[]> {
  return db.all<TopTrackEntry>(sql`
    SELECT
      ${streams.trackKey}           AS key,
      MAX(${streams.trackName})     AS name,
      MAX(${streams.artistName})    AS artistName,
      COUNT(*)                      AS plays,
      SUM(${streams.msPlayed})      AS ms
    FROM ${streams}
    WHERE ${enRango(range)} AND ${contadas()}
    GROUP BY ${streams.trackKey}
    ORDER BY ${ordenPor(metric)}
    LIMIT ${limite}
  `);
}

export async function getTopAlbums(
  db: Db,
  range: StatsRange,
  metric: Metric = "plays",
  limite = LIMITE_POR_DEFECTO,
): Promise<TopAlbumEntry[]> {
  return db.all<TopAlbumEntry>(sql`
    SELECT
      ${streams.albumKey}           AS key,
      MAX(${streams.albumName})     AS name,
      MAX(${streams.artistName})    AS artistName,
      COUNT(*)                      AS plays,
      SUM(${streams.msPlayed})      AS ms
    FROM ${streams}
    WHERE ${enRango(range)} AND ${contadas()}
      AND ${streams.albumKey} IS NOT NULL
    GROUP BY ${streams.albumKey}
    ORDER BY ${ordenPor(metric)}
    LIMIT ${limite}
  `);
}
```

- [ ] **Step 4: Ejecutar el test para verificar que pasa**

Run: `npm test -- stats-tops`
Expected: PASS, 14 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stats/tops.ts tests/stats-tops.test.ts
git commit -m "feat: rankings de artistas, canciones y álbumes"
```

---

## Task 4: Distribución temporal

**Files:**
- Create: `src/lib/stats/time.ts`
- Test: `tests/stats-time.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crea `tests/stats-time.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getByHour, getByWeekday, getByMonth } from "@/lib/stats/time";
import type { StatsRange } from "@/lib/stats/range";
import { createTestDb } from "./helpers/test-db";
import { seedStreams, stream } from "./helpers/seed-streams";

const ANIO: StatsRange = {
  fromDate: "2026-01-01",
  toDate: "2026-12-31",
  label: "2026",
  preset: "custom",
};

describe("getByHour", () => {
  it("devuelve siempre las 24 horas, con ceros donde no hubo nada", async () => {
    const { db } = createTestDb();
    const h = await getByHour(db, ANIO);

    expect(h).toHaveLength(24);
    expect(h.map((x) => x.hour)).toEqual(Array.from({ length: 24 }, (_, i) => i));
    expect(h.every((x) => x.plays === 0)).toBe(true);
  });

  it("cuenta cada escucha en su hora local", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: "2026-03-10", localHour: 3 }),
      stream({ localDate: "2026-03-10", localHour: 22 }),
      stream({ localDate: "2026-03-11", localHour: 22 }),
    ]);

    const h = await getByHour(db, ANIO);
    expect(h[3].plays).toBe(1);
    expect(h[22].plays).toBe(2);
    expect(h[0].plays).toBe(0);
  });

  it("suma también los milisegundos por hora", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: "2026-03-10", localHour: 9, msPlayed: 100_000 }),
      stream({ localDate: "2026-03-10", localHour: 9, msPlayed: 50_000 }),
    ]);

    expect((await getByHour(db, ANIO))[9].ms).toBe(150_000);
  });

  it("incluye la medianoche como hora 0", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [stream({ localDate: "2026-03-10", localHour: 0 })]);
    expect((await getByHour(db, ANIO))[0].plays).toBe(1);
  });
});

describe("getByWeekday", () => {
  it("devuelve siempre siete días empezando en lunes", async () => {
    const { db } = createTestDb();
    const w = await getByWeekday(db, ANIO);

    expect(w).toHaveLength(7);
    expect(w.map((x) => x.weekday)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("sitúa cada fecha en su día de la semana", async () => {
    // 2026-03-09 es lunes; 2026-03-15 es domingo.
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: "2026-03-09" }),
      stream({ localDate: "2026-03-15" }),
      stream({ localDate: "2026-03-15" }),
    ]);

    const w = await getByWeekday(db, ANIO);
    expect(w[0].plays).toBe(1); // lunes
    expect(w[6].plays).toBe(2); // domingo
  });
});

describe("getByMonth", () => {
  it("devuelve un punto por mes presente, en orden", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: "2026-01-15" }),
      stream({ localDate: "2026-03-01" }),
      stream({ localDate: "2026-03-20" }),
    ]);

    const m = await getByMonth(db, ANIO);
    expect(m.map((x) => x.month)).toEqual(["2026-01", "2026-03"]);
    expect(m.map((x) => x.plays)).toEqual([1, 2]);
  });

  it("no inventa meses vacíos", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [stream({ localDate: "2026-06-15" })]);
    expect(await getByMonth(db, ANIO)).toHaveLength(1);
  });

  it("ordena cronológicamente a través de años", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: "2026-01-05" }),
      stream({ localDate: "2025-12-20" }),
    ]);

    const rango: StatsRange = {
      fromDate: "2025-01-01",
      toDate: "2026-12-31",
      label: "",
      preset: "custom",
    };
    expect((await getByMonth(db, rango)).map((x) => x.month)).toEqual([
      "2025-12",
      "2026-01",
    ]);
  });
});
```

- [ ] **Step 2: Ejecutar el test para verificar que falla**

Run: `npm test -- stats-time`
Expected: FAIL — no se resuelve `@/lib/stats/time`.

- [ ] **Step 3: Escribir la implementación**

Crea `src/lib/stats/time.ts`:

```ts
import { sql } from "drizzle-orm";
import { streams } from "@/db/schema";
import type { StatsRange } from "./range";
import { enRango, type Db } from "./shared";

export type HourBucket = { hour: number; plays: number; ms: number };
export type WeekdayBucket = { weekday: number; plays: number; ms: number };
export type MonthBucket = { month: string; plays: number; ms: number };

/**
 * Devuelve las 24 horas siempre, rellenando con ceros.
 *
 * Un histograma al que le faltan las horas sin escuchas se dibuja mal y
 * miente visualmente: parecería que la madrugada no existe en vez de que está
 * vacía.
 */
export async function getByHour(
  db: Db,
  range: StatsRange,
): Promise<HourBucket[]> {
  const filas = db.all<{ hour: number; plays: number; ms: number }>(sql`
    SELECT
      ${streams.localHour}      AS hour,
      COUNT(*)                  AS plays,
      SUM(${streams.msPlayed})  AS ms
    FROM ${streams}
    WHERE ${enRango(range)}
    GROUP BY ${streams.localHour}
  `);

  const porHora = new Map(filas.map((f) => [f.hour, f]));

  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    plays: porHora.get(hour)?.plays ?? 0,
    ms: porHora.get(hour)?.ms ?? 0,
  }));
}

/**
 * Día de la semana con lunes = 0.
 *
 * `strftime('%w')` de SQLite devuelve domingo = 0, que no es como se lee una
 * semana en español. Se rota: `(%w + 6) % 7`.
 */
export async function getByWeekday(
  db: Db,
  range: StatsRange,
): Promise<WeekdayBucket[]> {
  const filas = db.all<{ weekday: number; plays: number; ms: number }>(sql`
    SELECT
      (CAST(strftime('%w', ${streams.localDate}) AS INTEGER) + 6) % 7 AS weekday,
      COUNT(*)                  AS plays,
      SUM(${streams.msPlayed})  AS ms
    FROM ${streams}
    WHERE ${enRango(range)}
    GROUP BY weekday
  `);

  const porDia = new Map(filas.map((f) => [f.weekday, f]));

  return Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    plays: porDia.get(weekday)?.plays ?? 0,
    ms: porDia.get(weekday)?.ms ?? 0,
  }));
}

/**
 * Un punto por mes con datos, sin rellenar los vacíos.
 *
 * Al contrario que las horas, aquí el rango es arbitrario y puede abarcar años:
 * rellenar produciría cientos de puntos a cero. Quien dibuje la gráfica decide
 * si interpola.
 */
export async function getByMonth(
  db: Db,
  range: StatsRange,
): Promise<MonthBucket[]> {
  return db.all<MonthBucket>(sql`
    SELECT
      substr(${streams.localDate}, 1, 7) AS month,
      COUNT(*)                           AS plays,
      SUM(${streams.msPlayed})           AS ms
    FROM ${streams}
    WHERE ${enRango(range)}
    GROUP BY month
    ORDER BY month ASC
  `);
}
```

- [ ] **Step 4: Ejecutar el test para verificar que pasa**

Run: `npm test -- stats-time`
Expected: PASS, 9 tests.

Si el test de días de la semana falla, comprueba en Node qué devuelve `strftime('%w', '2026-03-09')` en tu build de SQLite antes de tocar la rotación.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stats/time.ts tests/stats-time.test.ts
git commit -m "feat: distribución por hora, día de la semana y mes"
```

---

## Task 5: Rachas

**Files:**
- Create: `src/lib/stats/streaks.ts`
- Test: `tests/stats-streaks.test.ts`

Las rachas son el sitio donde los off-by-one son prácticamente obligatorios, así que el test es deliberadamente exhaustivo.

- [ ] **Step 1: Escribir el test que falla**

Crea `tests/stats-streaks.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getStreaks } from "@/lib/stats/streaks";
import { createTestDb } from "./helpers/test-db";
import { seedStreams, stream } from "./helpers/seed-streams";

const HOY = "2026-03-15";

describe("getStreaks", () => {
  it("sin datos, ambas rachas son cero", async () => {
    const { db } = createTestDb();
    expect(await getStreaks(db, HOY)).toEqual({
      actual: 0,
      maxima: 0,
      maximaDesde: null,
      maximaHasta: null,
    });
  });

  it("un solo día es una racha de uno", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [stream({ localDate: "2026-03-01" })]);

    const r = await getStreaks(db, HOY);
    expect(r.maxima).toBe(1);
    expect(r.maximaDesde).toBe("2026-03-01");
    expect(r.maximaHasta).toBe("2026-03-01");
  });

  it("varias escuchas el mismo día siguen siendo un día", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: "2026-03-01" }),
      stream({ localDate: "2026-03-01" }),
      stream({ localDate: "2026-03-01" }),
    ]);

    expect((await getStreaks(db, HOY)).maxima).toBe(1);
  });

  it("cuenta días consecutivos", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: "2026-03-01" }),
      stream({ localDate: "2026-03-02" }),
      stream({ localDate: "2026-03-03" }),
    ]);

    const r = await getStreaks(db, HOY);
    expect(r.maxima).toBe(3);
    expect(r.maximaDesde).toBe("2026-03-01");
    expect(r.maximaHasta).toBe("2026-03-03");
  });

  it("un hueco parte la racha", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: "2026-03-01" }),
      stream({ localDate: "2026-03-02" }),
      // falta el 3
      stream({ localDate: "2026-03-04" }),
    ]);

    expect((await getStreaks(db, HOY)).maxima).toBe(2);
  });

  it("se queda con la racha más larga cuando hay varias", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: "2026-03-01" }),
      stream({ localDate: "2026-03-02" }),
      stream({ localDate: "2026-03-05" }),
      stream({ localDate: "2026-03-06" }),
      stream({ localDate: "2026-03-07" }),
      stream({ localDate: "2026-03-08" }),
    ]);

    const r = await getStreaks(db, HOY);
    expect(r.maxima).toBe(4);
    expect(r.maximaDesde).toBe("2026-03-05");
  });

  it("cruza el cambio de mes", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: "2026-01-30" }),
      stream({ localDate: "2026-01-31" }),
      stream({ localDate: "2026-02-01" }),
    ]);

    expect((await getStreaks(db, HOY)).maxima).toBe(3);
  });

  it("cruza el 29 de febrero de un año bisiesto", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: "2024-02-28" }),
      stream({ localDate: "2024-02-29" }),
      stream({ localDate: "2024-03-01" }),
    ]);

    expect((await getStreaks(db, "2024-03-05")).maxima).toBe(3);
  });

  it("la racha actual llega hasta hoy", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: "2026-03-13" }),
      stream({ localDate: "2026-03-14" }),
      stream({ localDate: "2026-03-15" }),
    ]);

    expect((await getStreaks(db, "2026-03-15")).actual).toBe(3);
  });

  it("la racha actual sigue viva si se escuchó ayer pero aún no hoy", async () => {
    // A las 9 de la mañana todavía no has puesto nada; la racha no está rota.
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: "2026-03-13" }),
      stream({ localDate: "2026-03-14" }),
    ]);

    expect((await getStreaks(db, "2026-03-15")).actual).toBe(2);
  });

  it("la racha actual es cero si la última escucha fue anteayer", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: "2026-03-12" }),
      stream({ localDate: "2026-03-13" }),
    ]);

    expect((await getStreaks(db, "2026-03-15")).actual).toBe(0);
  });

  it("una racha pasada no cuenta como actual", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: "2026-01-01" }),
      stream({ localDate: "2026-01-02" }),
      stream({ localDate: "2026-01-03" }),
    ]);

    const r = await getStreaks(db, HOY);
    expect(r.maxima).toBe(3);
    expect(r.actual).toBe(0);
  });
});
```

- [ ] **Step 2: Ejecutar el test para verificar que falla**

Run: `npm test -- stats-streaks`
Expected: FAIL — no se resuelve `@/lib/stats/streaks`.

- [ ] **Step 3: Escribir la implementación**

Crea `src/lib/stats/streaks.ts`:

```ts
import { sql } from "drizzle-orm";
import { streams } from "@/db/schema";
import type { Db } from "./shared";

export type Streaks = {
  /** Días consecutivos que llegan hasta hoy o ayer. Cero si se rompió antes. */
  actual: number;
  maxima: number;
  maximaDesde: string | null;
  maximaHasta: string | null;
};

const DIA_MS = 24 * 60 * 60 * 1000;

/** Distancia en días de calendario entre dos fechas 'YYYY-MM-DD'. */
function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DIA_MS);
}

/**
 * Rachas de días consecutivos con al menos una escucha.
 *
 * No recibe rango: una racha es una propiedad del historial completo, y
 * recortarla a una ventana daría un número que cambia según lo que estés
 * mirando. `hoy` se pasa como argumento para que la función sea determinista y
 * testeable.
 *
 * La racha actual admite que hoy todavía no haya nada: a las nueve de la mañana
 * la racha no está rota, solo no se ha alimentado aún. Se rompe cuando la
 * última escucha es de anteayer o antes.
 */
export async function getStreaks(db: Db, hoy: string): Promise<Streaks> {
  const filas = db.all<{ dia: string }>(sql`
    SELECT DISTINCT ${streams.localDate} AS dia
    FROM ${streams}
    ORDER BY dia ASC
  `);

  if (filas.length === 0) {
    return { actual: 0, maxima: 0, maximaDesde: null, maximaHasta: null };
  }

  const dias = filas.map((f) => f.dia);

  let maxima = 1;
  let maximaDesde = dias[0];
  let maximaHasta = dias[0];

  let longitud = 1;
  let inicio = dias[0];

  for (let i = 1; i < dias.length; i++) {
    if (diasEntre(dias[i - 1], dias[i]) === 1) {
      longitud += 1;
    } else {
      longitud = 1;
      inicio = dias[i];
    }

    if (longitud > maxima) {
      maxima = longitud;
      maximaDesde = inicio;
      maximaHasta = dias[i];
    }
  }

  // La racha actual: se recorre hacia atrás desde el final.
  const ultimo = dias[dias.length - 1];
  const distanciaAHoy = diasEntre(ultimo, hoy);

  let actual = 0;
  if (distanciaAHoy === 0 || distanciaAHoy === 1) {
    actual = 1;
    for (let i = dias.length - 1; i > 0; i--) {
      if (diasEntre(dias[i - 1], dias[i]) === 1) actual += 1;
      else break;
    }
  }

  return { actual, maxima, maximaDesde, maximaHasta };
}
```

- [ ] **Step 4: Ejecutar el test para verificar que pasa**

Run: `npm test -- stats-streaks`
Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stats/streaks.ts tests/stats-streaks.test.ts
git commit -m "feat: rachas de días consecutivos"
```

---

## Task 6: Ficha de artista

**Files:**
- Create: `src/lib/stats/detail.ts`
- Test: `tests/stats-detail.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crea `tests/stats-detail.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getArtistDetail } from "@/lib/stats/detail";
import type { StatsRange } from "@/lib/stats/range";
import { createTestDb } from "./helpers/test-db";
import { seedStreams, stream } from "./helpers/seed-streams";

const HISTORICO: StatsRange = {
  fromDate: "1970-01-01",
  toDate: "2099-12-31",
  label: "Histórico",
  preset: "all",
};

describe("getArtistDetail", () => {
  it("devuelve null para un artista que no existe", async () => {
    const { db } = createTestDb();
    expect(await getArtistDetail(db, HISTORICO, "inexistente")).toBeNull();
  });

  it("cuenta veces y suma tiempo", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ artistName: "Duster", msPlayed: 100_000, ts: 1000 }),
      stream({ artistName: "Duster", msPlayed: 200_000, ts: 2000 }),
    ]);

    const f = await getArtistDetail(db, HISTORICO, "duster");
    expect(f?.plays).toBe(2);
    expect(f?.ms).toBe(300_000);
  });

  it("da la primera y la última vez", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ artistName: "Duster", ts: 5000, localDate: "2026-03-05" }),
      stream({ artistName: "Duster", ts: 1000, localDate: "2026-01-01" }),
      stream({ artistName: "Duster", ts: 9000, localDate: "2026-06-30" }),
    ]);

    const f = await getArtistDetail(db, HISTORICO, "duster");
    expect(f?.primeraVez).toBe(1000);
    expect(f?.ultimaVez).toBe(9000);
  });

  it("devuelve el nombre tal como se escribió", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [stream({ artistName: "Sigur Rós" })]);
    expect((await getArtistDetail(db, HISTORICO, "sigur ros"))?.name).toBe(
      "Sigur Rós",
    );
  });

  it("da la posición en el ranking del rango", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ artistName: "Primero" }),
      stream({ artistName: "Primero" }),
      stream({ artistName: "Primero" }),
      stream({ artistName: "Segundo" }),
      stream({ artistName: "Segundo" }),
      stream({ artistName: "Tercero" }),
    ]);

    expect((await getArtistDetail(db, HISTORICO, "segundo"))?.posicion).toBe(2);
    expect((await getArtistDetail(db, HISTORICO, "tercero"))?.posicion).toBe(3);
  });

  it("incluye las canciones más escuchadas de ese artista", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ artistName: "Duster", trackName: "Inside Out" }),
      stream({ artistName: "Duster", trackName: "Inside Out" }),
      stream({ artistName: "Duster", trackName: "Gold Dust" }),
      stream({ artistName: "Slowdive", trackName: "Alison" }),
    ]);

    const f = await getArtistDetail(db, HISTORICO, "duster");
    expect(f?.topTracks.map((t) => t.name)).toEqual(["Inside Out", "Gold Dust"]);
    expect(f?.topTracks[0].plays).toBe(2);
  });

  it("respeta el rango en las cifras", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ artistName: "Duster", localDate: "2026-01-15" }),
      stream({ artistName: "Duster", localDate: "2026-06-15" }),
    ]);

    const enero: StatsRange = {
      fromDate: "2026-01-01",
      toDate: "2026-01-31",
      label: "",
      preset: "custom",
    };

    expect((await getArtistDetail(db, enero, "duster"))?.plays).toBe(1);
  });

  it("no cuenta reproducciones por debajo del umbral", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ artistName: "Duster", msPlayed: 5_000 }),
      stream({ artistName: "Duster", msPlayed: 200_000 }),
    ]);

    expect((await getArtistDetail(db, HISTORICO, "duster"))?.plays).toBe(1);
  });
});
```

- [ ] **Step 2: Ejecutar el test para verificar que falla**

Run: `npm test -- stats-detail`
Expected: FAIL — no se resuelve `@/lib/stats/detail`.

- [ ] **Step 3: Escribir la implementación**

Crea `src/lib/stats/detail.ts`:

```ts
import { sql } from "drizzle-orm";
import { streams } from "@/db/schema";
import type { StatsRange } from "./range";
import { contadas, enRango, type Db } from "./shared";
import { getTopArtists } from "./tops";

export type ArtistTrack = { key: string; name: string; plays: number };

export type ArtistDetail = {
  key: string;
  name: string;
  plays: number;
  ms: number;
  /** Epoch ms de la primera y la última escucha dentro del rango. */
  primeraVez: number;
  ultimaVez: number;
  /**
   * Puesto dentro del propio ranking del usuario, empezando en 1.
   * `null` si el artista queda fuera de los que se consultaron.
   */
  posicion: number | null;
  topTracks: ArtistTrack[];
};

/** Cuántos artistas se miran para calcular la posición. */
const PROFUNDIDAD_RANKING = 1000;

export async function getArtistDetail(
  db: Db,
  range: StatsRange,
  artistKey: string,
): Promise<ArtistDetail | null> {
  const resumen = db.all<{
    name: string | null;
    plays: number;
    ms: number | null;
    primera: number | null;
    ultima: number | null;
  }>(sql`
    SELECT
      MAX(${streams.artistName})  AS name,
      COUNT(*)                    AS plays,
      SUM(${streams.msPlayed})    AS ms,
      MIN(${streams.ts})          AS primera,
      MAX(${streams.ts})          AS ultima
    FROM ${streams}
    WHERE ${enRango(range)} AND ${contadas()}
      AND ${streams.artistKey} = ${artistKey}
  `)[0];

  // Con cero filas, los agregados devuelven NULL y COUNT devuelve 0.
  if (!resumen || resumen.plays === 0) return null;

  const topTracks = db.all<ArtistTrack>(sql`
    SELECT
      ${streams.trackKey}       AS key,
      MAX(${streams.trackName}) AS name,
      COUNT(*)                  AS plays
    FROM ${streams}
    WHERE ${enRango(range)} AND ${contadas()}
      AND ${streams.artistKey} = ${artistKey}
    GROUP BY ${streams.trackKey}
    ORDER BY plays DESC, name ASC
    LIMIT 10
  `);

  const ranking = await getTopArtists(db, range, "plays", PROFUNDIDAD_RANKING);
  const indice = ranking.findIndex((a) => a.key === artistKey);

  return {
    key: artistKey,
    name: resumen.name ?? artistKey,
    plays: resumen.plays,
    ms: resumen.ms ?? 0,
    primeraVez: resumen.primera ?? 0,
    ultimaVez: resumen.ultima ?? 0,
    posicion: indice >= 0 ? indice + 1 : null,
    topTracks,
  };
}
```

- [ ] **Step 4: Ejecutar el test para verificar que pasa**

Run: `npm test -- stats-detail`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stats/detail.ts tests/stats-detail.test.ts
git commit -m "feat: ficha de artista con posición y primeras escuchas"
```

---

## Task 7: Historial paginado

**Files:**
- Create: `src/lib/stats/history.ts`
- Test: `tests/stats-history.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crea `tests/stats-history.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getHistory } from "@/lib/stats/history";
import type { StatsRange } from "@/lib/stats/range";
import { createTestDb } from "./helpers/test-db";
import { seedStreams, stream } from "./helpers/seed-streams";

const HISTORICO: StatsRange = {
  fromDate: "1970-01-01",
  toDate: "2099-12-31",
  label: "Histórico",
  preset: "all",
};

describe("getHistory", () => {
  it("devuelve vacío sin datos", async () => {
    const { db } = createTestDb();
    expect(await getHistory(db, HISTORICO)).toEqual({ rows: [], total: 0 });
  });

  it("ordena de más reciente a más antiguo", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ ts: 1000, trackName: "Vieja" }),
      stream({ ts: 3000, trackName: "Nueva" }),
      stream({ ts: 2000, trackName: "Media" }),
    ]);

    const h = await getHistory(db, HISTORICO);
    expect(h.rows.map((r) => r.trackName)).toEqual([
      "Nueva",
      "Media",
      "Vieja",
    ]);
  });

  it("informa del total aunque devuelva una página", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(
      sqlite,
      Array.from({ length: 25 }, (_, i) => stream({ ts: 1000 + i })),
    );

    const h = await getHistory(db, HISTORICO, { limite: 10 });
    expect(h.rows).toHaveLength(10);
    expect(h.total).toBe(25);
  });

  it("pagina con desplazamiento", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ ts: 3000, trackName: "A" }),
      stream({ ts: 2000, trackName: "B" }),
      stream({ ts: 1000, trackName: "C" }),
    ]);

    const h = await getHistory(db, HISTORICO, { limite: 1, desplazamiento: 1 });
    expect(h.rows.map((r) => r.trackName)).toEqual(["B"]);
  });

  it("busca en el título de la canción", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ trackName: "Inside Out" }),
      stream({ trackName: "Gold Dust" }),
    ]);

    const h = await getHistory(db, HISTORICO, { busqueda: "inside" });
    expect(h.rows.map((r) => r.trackName)).toEqual(["Inside Out"]);
    expect(h.total).toBe(1);
  });

  it("busca también en el nombre del artista", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ artistName: "Duster", trackName: "X" }),
      stream({ artistName: "Slowdive", trackName: "Y" }),
    ]);

    expect((await getHistory(db, HISTORICO, { busqueda: "slow" })).rows).toHaveLength(1);
  });

  it("la búsqueda ignora mayúsculas y acentos", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [stream({ artistName: "Sigur Rós" })]);

    expect((await getHistory(db, HISTORICO, { busqueda: "SIGUR ROS" })).rows).toHaveLength(1);
  });

  it("respeta el rango", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: "2026-01-15" }),
      stream({ localDate: "2026-06-15" }),
    ]);

    const enero: StatsRange = {
      fromDate: "2026-01-01",
      toDate: "2026-01-31",
      label: "",
      preset: "custom",
    };

    expect((await getHistory(db, enero)).total).toBe(1);
  });

  it("incluye todas las escuchas, también las cortas", async () => {
    // El historial es un registro, no un ranking: si sonó tres segundos,
    // sonó, y ocultarlo haría que el usuario no entendiera sus propios datos.
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [stream({ msPlayed: 3_000 })]);
    expect((await getHistory(db, HISTORICO)).total).toBe(1);
  });
});
```

- [ ] **Step 2: Ejecutar el test para verificar que falla**

Run: `npm test -- stats-history`
Expected: FAIL — no se resuelve `@/lib/stats/history`.

- [ ] **Step 3: Escribir la implementación**

Crea `src/lib/stats/history.ts`:

```ts
import { sql, type SQL } from "drizzle-orm";
import { streams } from "@/db/schema";
import { normalizeName } from "./normalize";
import type { StatsRange } from "./range";
import { enRango, type Db } from "./shared";

export type HistoryRow = {
  id: number;
  ts: number;
  trackName: string;
  artistName: string;
  albumName: string | null;
  msPlayed: number;
  localDate: string;
  localHour: number;
  source: string;
};

export type HistoryPage = { rows: HistoryRow[]; total: number };

export type HistoryOptions = {
  limite?: number;
  desplazamiento?: number;
  busqueda?: string;
};

const LIMITE_POR_DEFECTO = 100;

/**
 * Filtro de búsqueda sobre las claves normalizadas.
 *
 * Se busca en `artist_key` y `track_key`, no en los nombres visibles, porque
 * esas columnas ya están en minúsculas y sin acentos: así "SIGUR ROS" encuentra
 * "Sigur Rós" sin necesitar `COLLATE` ni normalizar en SQL.
 *
 * Es un `LIKE` con comodín inicial, que no puede usar índice. Con cientos de
 * miles de filas seguirá siendo un escaneo completo; si algún día molesta, la
 * respuesta es FTS5, no otro índice.
 */
function filtroBusqueda(busqueda: string): SQL {
  const patron = `%${normalizeName(busqueda)}%`;
  return sql`(${streams.artistKey} LIKE ${patron} OR ${streams.trackKey} LIKE ${patron})`;
}

export async function getHistory(
  db: Db,
  range: StatsRange,
  opciones: HistoryOptions = {},
): Promise<HistoryPage> {
  const limite = opciones.limite ?? LIMITE_POR_DEFECTO;
  const desplazamiento = opciones.desplazamiento ?? 0;

  const busqueda = opciones.busqueda?.trim();
  const filtro = busqueda
    ? sql`${enRango(range)} AND ${filtroBusqueda(busqueda)}`
    : enRango(range);

  const total = db.all<{ n: number }>(sql`
    SELECT COUNT(*) AS n FROM ${streams} WHERE ${filtro}
  `)[0]?.n ?? 0;

  const rows = db.all<HistoryRow>(sql`
    SELECT
      ${streams.id}          AS id,
      ${streams.ts}          AS ts,
      ${streams.trackName}   AS trackName,
      ${streams.artistName}  AS artistName,
      ${streams.albumName}   AS albumName,
      ${streams.msPlayed}    AS msPlayed,
      ${streams.localDate}   AS localDate,
      ${streams.localHour}   AS localHour,
      ${streams.source}      AS source
    FROM ${streams}
    WHERE ${filtro}
    ORDER BY ${streams.ts} DESC
    LIMIT ${limite} OFFSET ${desplazamiento}
  `);

  return { rows, total };
}
```

- [ ] **Step 4: Ejecutar el test para verificar que pasa**

Run: `npm test -- stats-history`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stats/history.ts tests/stats-history.test.ts
git commit -m "feat: historial paginado con búsqueda"
```

---

## Task 8: Reorganizar las rutas

Antes de construir la portada hay que hacerle sitio: hoy `/` es el índice de playlists.

**Files:**
- Create: `src/app/biblioteca/page.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/components/TopBar.tsx`

- [ ] **Step 1: Mover el índice de playlists a `/biblioteca`**

Copia el contenido íntegro de `src/app/page.tsx` a `src/app/biblioteca/page.tsx`, sin cambiar nada salvo el `active` que se le pasa a `TopBar`, que pasa a ser `"biblioteca"`.

`src/app/page.tsx` queda temporalmente como una redirección, que se sustituye en la Task 9:

```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/biblioteca");
}
```

- [ ] **Step 2: Actualizar la navegación**

En `src/components/TopBar.tsx`, amplía la unión de `active` a:

```tsx
  active?:
    | "portada"
    | "biblioteca"
    | "library"
    | "tags"
    | "smart"
    | "stats"
    | "ajustes";
```

Y sustituye el bloque de `NavLink` para que quede:

```tsx
          <NavLink href="/" active={active === "portada"}>
            Portada
          </NavLink>
          <NavLink href="/biblioteca" active={active === "biblioteca"}>
            Biblioteca
          </NavLink>
          <NavLink href="/library" active={active === "library"}>
            Liked
          </NavLink>
          <NavLink href="/tags" active={active === "tags"}>
            Tags
          </NavLink>
          <NavLink href="/smart" active={active === "smart"}>
            Smart
          </NavLink>
          <NavLink href="/ajustes" active={active === "ajustes"}>
            Ajustes
          </NavLink>
```

Se retira el enlace a `/stats`: esa página analiza la biblioteca de Liked Songs, no las escuchas, y la portada la sustituye como destino principal. La ruta sigue existiendo, solo deja de estar en la navegación.

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: sin errores.

Con el servidor corriendo, comprobar que `/biblioteca` responde y `/` redirige:

```bash
curl -s -o /dev/null -w "biblioteca=%{http_code}\n" http://127.0.0.1:3000/biblioteca
curl -s -o /dev/null -w "raiz=%{http_code} destino=%{redirect_url}\n" http://127.0.0.1:3000/
```

Sin sesión ambas redirigen al login; eso ya confirma que compilan y enrutan.

- [ ] **Step 4: Commit**

```bash
git add src/app/biblioteca/page.tsx src/app/page.tsx src/components/TopBar.tsx
git commit -m "refactor: mover el índice de playlists a /biblioteca"
```

---

## Task 9: La portada

**Files:**
- Create: `src/components/stats/RangePicker.tsx`
- Create: `src/components/stats/TopList.tsx`
- Create: `src/components/stats/HourHistogram.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Selector de rango**

Crea `src/components/stats/RangePicker.tsx`:

```tsx
import Link from "next/link";
import { PRESETS, type StatsRange } from "@/lib/stats/range";

/**
 * El rango vive en la URL, así que el selector son enlaces, no estado.
 *
 * Nada de JavaScript de cliente: cada opción es un `<Link>` que recarga la
 * página con otro `?preset=`. El botón atrás funciona y la vista se puede
 * marcar como favorita.
 */
export default function RangePicker({ range }: { range: StatsRange }) {
  return (
    <nav className="flex flex-wrap items-center gap-4">
      {Object.entries(PRESETS).map(([id, { label }]) => (
        <Link
          key={id}
          href={`/?preset=${id}`}
          className={`label-mono transition-colors ${
            range.preset === id ? "text-acid" : "text-mute hover:text-cream"
          }`}
        >
          {label}
        </Link>
      ))}
      <span className="label-mono text-mute">
        {range.fromDate} → {range.toDate}
      </span>
    </nav>
  );
}
```

- [ ] **Step 2: Lista de ranking**

Crea `src/components/stats/TopList.tsx`:

```tsx
type Entrada = { key: string; name: string; plays: number; ms: number };

/**
 * Muestra siempre las dos cifras, reproducciones y minutos.
 *
 * Un ranking ordenado solo por una de ellas induce a error: un artista de temas
 * largos gana por tiempo y pierde por número de escuchas, y quien vea una sola
 * columna no sabrá por qué está donde está.
 */
export default function TopList({
  titulo,
  entradas,
  vacio,
}: {
  titulo: string;
  entradas: Entrada[];
  vacio: string;
}) {
  return (
    <section>
      <p className="label-mono text-mute mb-4">{titulo}</p>

      {entradas.length === 0 ? (
        <p className="font-serif italic text-cream-dim">{vacio}</p>
      ) : (
        <ol>
          {entradas.map((e, i) => (
            <li
              key={e.key}
              className="flex items-baseline justify-between gap-4 py-2 hairline-b"
            >
              <span className="flex items-baseline gap-3 min-w-0">
                <span className="label-mono text-mute num-tabular">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="truncate">{e.name}</span>
              </span>
              <span className="label-mono text-mute num-tabular whitespace-nowrap">
                {e.plays} · {Math.round(e.ms / 60000)} min
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Histograma por hora**

Crea `src/components/stats/HourHistogram.tsx`:

```tsx
type Bucket = { hour: number; plays: number; ms: number };

/**
 * Histograma en SVG a mano.
 *
 * El proyecto no usa librerías de gráficas por decisión explícita, y para
 * veinticuatro barras no hacen falta: son cuatro líneas de SVG y se controla
 * exactamente cómo se ve.
 */
export default function HourHistogram({ buckets }: { buckets: Bucket[] }) {
  const max = Math.max(1, ...buckets.map((b) => b.plays));

  return (
    <section>
      <p className="label-mono text-mute mb-4">A qué hora escuchas</p>

      <svg viewBox="0 0 240 60" className="w-full h-24" role="img"
           aria-label="Reproducciones por hora del día">
        {buckets.map((b) => (
          <rect
            key={b.hour}
            x={b.hour * 10 + 1}
            y={50 - (b.plays / max) * 46}
            width={8}
            height={Math.max(0.5, (b.plays / max) * 46)}
            className="fill-acid"
          />
        ))}
        {[0, 6, 12, 18].map((h) => (
          <text
            key={h}
            x={h * 10 + 5}
            y={58}
            textAnchor="middle"
            className="fill-mute"
            style={{ fontSize: 5 }}
          >
            {h}h
          </text>
        ))}
      </svg>
    </section>
  );
}
```

- [ ] **Step 4: La página**

Sustituye por completo `src/app/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db";
import { getMe } from "@/lib/spotify";
import { parseRange } from "@/lib/stats/range";
import { resolveTimeZone, localParts } from "@/lib/stats/local-time";
import { getTotals } from "@/lib/stats/totals";
import { getTopArtists, getTopTracks } from "@/lib/stats/tops";
import { getByHour } from "@/lib/stats/time";
import { getStreaks } from "@/lib/stats/streaks";
import TopBar from "@/components/TopBar";
import RangePicker from "@/components/stats/RangePicker";
import TopList from "@/components/stats/TopList";
import HourHistogram from "@/components/stats/HourHistogram";

export const dynamic = "force-dynamic";

export default async function Portada({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string; desde?: string; hasta?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/biblioteca");

  const params = await searchParams;
  const timeZone = resolveTimeZone(process.env);
  const ahora = Date.now();
  const range = parseRange(params, ahora, timeZone);
  const hoy = localParts(ahora, timeZone).localDate;

  const [me, totals, artistas, canciones, horas, rachas] = await Promise.all([
    getMe(),
    getTotals(db, range),
    getTopArtists(db, range, "plays", 10),
    getTopTracks(db, range, "plays", 10),
    getByHour(db, range),
    getStreaks(db, hoy),
  ]);

  const minutos = Math.round(totals.msTotal / 60000);

  return (
    <main className="min-h-screen flex flex-col">
      <TopBar me={me} active="portada" />

      <section className="px-8 py-6 hairline-b">
        <RangePicker range={range} />
      </section>

      <section className="px-8 py-16 hairline-b">
        <p className="label-mono text-acid mb-6">{range.label}</p>
        <p
          className="display num-tabular text-[clamp(3.5rem,14vw,11rem)] text-acid leading-none"
          style={{ fontVariationSettings: '"opsz" 144, "SOFT" 0, "WONK" 1' }}
        >
          {minutos.toLocaleString("es")}
        </p>
        <p className="font-serif italic text-lg text-cream-dim mt-4">
          minutos · {totals.reproducciones.toLocaleString("es")} reproducciones ·{" "}
          {totals.artistas.toLocaleString("es")} artistas ·{" "}
          {totals.diasActivos.toLocaleString("es")} días con música
        </p>
        {rachas.actual > 0 && (
          <p className="label-mono text-mute mt-4">
            Racha actual: {rachas.actual} días · Máxima: {rachas.maxima}
          </p>
        )}
      </section>

      {totals.reproducciones === 0 ? (
        <section className="px-8 py-16">
          <p className="font-serif italic text-xl text-cream-dim max-w-lg">
            Todavía no hay escuchas en este rango. La captura guarda lo que
            suene a partir de ahora; cuando importes tu histórico de Spotify
            aparecerá aquí todo lo anterior.
          </p>
        </section>
      ) : (
        <>
          <section className="px-8 py-12 hairline-b grid grid-cols-1 lg:grid-cols-2 gap-12">
            <TopList
              titulo="Artistas"
              entradas={artistas}
              vacio="Nada en este rango."
            />
            <TopList
              titulo="Canciones"
              entradas={canciones}
              vacio="Nada en este rango."
            />
          </section>

          <section className="px-8 py-12 hairline-b">
            <HourHistogram buckets={horas} />
          </section>
        </>
      )}

      <footer className="hairline-b mt-auto" />
      <div className="px-8 py-5 flex items-center justify-between label-mono text-mute">
        <span>PORTADA</span>
        <span>{totals.reproducciones.toLocaleString("es")} REPRODUCCIONES</span>
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: sin errores, toda la suite en verde.

Con el servidor corriendo, comprobar que la ruta compila:

```bash
curl -s -o /dev/null -w "portada=%{http_code}\n" http://127.0.0.1:3000/
```

Sin cookie de sesión redirige; eso confirma que compiló. **Pídele al usuario que la abra en el navegador** y confirme que ve sus cifras — es la primera vez que sus datos aparecen en pantalla, y ningún `curl` sustituye a mirarlo.

- [ ] **Step 6: Commit**

```bash
git add src/components/stats src/app/page.tsx
git commit -m "feat: portada con totales, rankings, rachas e histograma"
```

---

## Verificación final

- [ ] **Todos los tests pasan**

Run: `npm test`
Expected: 9 archivos nuevos de test en verde, ~145 tests en total.

- [ ] **Tipos y lint limpios**

Run: `npx tsc --noEmit && npm run lint`

- [ ] **La app compila**

Run: `npm run build`

- [ ] **Nada de lo existente se rompió**

Recorrer `/biblioteca`, `/library`, `/tags`, `/smart`, `/ajustes` y `/debug`.

- [ ] **La portada muestra datos reales**

Abrirla en el navegador con sesión y comprobar que las cifras son plausibles. Contrastar el total de reproducciones con:

```bash
node -e "const D=require('better-sqlite3');const d=new D('data/ledger.db',{readonly:true});console.log(d.prepare('SELECT COUNT(*) n FROM streams WHERE ms_played >= 30000').get())"
```

- [ ] **La captura sigue funcionando**

`/ajustes` debe seguir mostrando ejecuciones recientes sin errores.

---

## Qué queda fuera

- **`skips.ts`** — necesita filas `source='import'`, que no existirán hasta el dump.
- **`genres.ts`** — depende de `artist_resolution` y Last.fm; es un subsistema propio.
- **Fichas de canción y álbum** — misma forma que la de artista, con otra columna de agrupación.
- **Páginas `/escucha` y `/historial`** — los módulos ya las soportan; falta la interfaz.
- **Fase 3 (importador), Fase 5 (interfaz completa) y Fase 6 (tarjetas)** — planes aparte.
