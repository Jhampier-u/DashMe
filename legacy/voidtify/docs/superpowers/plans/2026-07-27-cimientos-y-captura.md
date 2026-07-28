# Cimientos y captura continua — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar corriendo un cron que capture cada escucha de Spotify en una tabla local `streams`, junto con los cimientos (normalización, rangos, zona horaria, cliente HTTP sin sesión) sobre los que se construirán las estadísticas.

**Architecture:** Se añade una tabla `streams` como fuente única de escuchas. El núcleo de `spotifyFetch` se extrae a una función que recibe el token como argumento, permitiendo un segundo envoltorio que lo obtiene de la base de datos en lugar de la sesión — eso es lo que hace posible que un cron sin cookie llame a la API. El endpoint `/api/cron/capture`, protegido por secreto, lee `/me/player/recently-played` e inserta filas con `INSERT OR IGNORE`.

**Tech Stack:** Next.js 16 (fork feb 2026, App Router), TypeScript, SQLite vía better-sqlite3 + Drizzle ORM, Auth.js v5, Vitest.

**Diseño de referencia:** [`docs/superpowers/specs/2026-07-27-voidtify-estadisticas-escucha-design.md`](../specs/2026-07-27-voidtify-estadisticas-escucha-design.md)

**Rama:** `feat/estadisticas-escucha`

---

## Estructura de archivos

**Se crean:**

| Archivo | Responsabilidad |
|---|---|
| `vitest.config.ts` | Configuración del runner |
| `src/db/schema-sql.ts` | El DDL como constante exportada, para que producción y tests creen el mismo esquema |
| `src/lib/stats/normalize.ts` | Normalización de nombres a claves de agrupación (puro) |
| `src/lib/stats/local-time.ts` | Conversión de epoch a fecha y hora en `STATS_TZ` (puro) |
| `src/lib/stats/range.ts` | Presets de rango y resolución a `{from, to, label}` (puro) |
| `src/lib/spotify-core.ts` | Núcleo HTTP: rate limit, backoff, reintentos. Recibe el token |
| `src/lib/spotify-headless.ts` | Envoltorio que saca el token de la base de datos |
| `src/lib/credentials.ts` | Lectura y escritura de `spotify_credentials` |
| `src/lib/capture/map-recently-played.ts` | Convierte la respuesta de la API en filas `streams` (puro) |
| `src/lib/capture/run-capture.ts` | Orquesta una ejecución de captura |
| `src/lib/capture/top-snapshots.ts` | Foto diaria de los tops precalculados por Spotify |
| `src/lib/streams.ts` | Inserción de filas `streams` con dedup |
| `src/app/api/cron/capture/route.ts` | Endpoint del cron |
| `src/app/ajustes/page.tsx` | Salud de la captura + botón de ejecución manual |
| `src/components/CaptureHealth.tsx` | Panel cliente con el botón |
| `src/lib/capture-actions.ts` | Server action para la ejecución manual |
| `tests/normalize.test.ts` … | Tests unitarios |

**Se modifican:**

| Archivo | Cambio |
|---|---|
| `package.json` | Scripts de test + dependencia `vitest` |
| `src/db/index.ts` | Usar el DDL extraído; añadir tablas nuevas |
| `src/db/schema.ts` | Esquemas Drizzle de las tablas nuevas |
| `src/lib/spotify.ts` | Delegar en `spotify-core`; la firma pública no cambia |
| `src/auth.ts` | Sembrar credenciales en el callback `jwt` |
| `.env.local.example` | `CRON_SECRET` y `STATS_TZ` |

**Nota sobre decomposición:** el DDL vive hoy incrustado en `createDb()` (`src/db/index.ts:22-71`). Se extrae a `src/db/schema-sql.ts` porque los tests necesitan crear el mismo esquema en memoria, y duplicar el DDL garantizaría que producción y tests diverjan.

---

## Task 0: Preparar el entorno y verificar los endpoints

Esta tarea no escribe código de producción. Verifica supuestos que, de ser falsos, invalidan las tareas 9-13.

**Files:** ninguno

- [ ] **Step 1: Instalar dependencias**

```bash
npm install
```

Expected: termina sin errores y crea `node_modules/`.

- [ ] **Step 2: Leer la documentación del fork de Next sobre route handlers**

`AGENTS.md` advierte que esta versión de Next tiene cambios que rompen respecto a lo conocido. Antes de escribir la Task 11 hay que leer:

```bash
ls node_modules/next/dist/docs/
```

Busca y lee el documento sobre **route handlers** (`app/api`) y el de **server actions**. Anota cualquier diferencia respecto a la forma habitual (`export async function POST(request: Request)`) y aplícala en la Task 11. Si la firma difiere de la que aparece en este plan, **manda la documentación, no el plan**.

- [ ] **Step 3: Verificar que los endpoints de Spotify existen en este fork**

Arranca la app y entra a `/debug`, que ya tiene sondas para ambos endpoints (`src/app/debug/page.tsx:18-19`):

```bash
npm run dev
```

Abre `http://127.0.0.1:3000/debug` (hay que estar logueado).

Expected: las filas **"Top artists"** y **"Recently played"** muestran `200 ✓`.

**Si "Recently played" falla:** para el plan y avisa. Las tareas 10, 12, 14, 15 y 16 dependen por completo de ese endpoint; si no existe, no hay captura posible y todo el proyecto pasa a depender exclusivamente del dump.

**Si falla solo "Top artists":** no bloquea nada salvo la Task 13, que se puede saltar. Las escuchas se capturan igual.

- [ ] **Step 4: Anotar el resultado**

No hay commit en esta tarea. Deja constancia en el mensaje al usuario de qué devolvió cada sonda.

---

## Task 1: Instalar y configurar Vitest

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/sanity.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Instalar Vitest**

```bash
npm install -D vitest
```

- [ ] **Step 2: Crear la configuración**

Crea `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    // Los tests tocan better-sqlite3 y node:crypto: entorno Node, no jsdom.
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
```

El alias `@` replica el de `tsconfig.json` para que los imports funcionen igual en tests y en la app.

- [ ] **Step 3: Añadir los scripts**

En `package.json`, dentro de `"scripts"`, añade estas dos líneas después de `"lint": "eslint",`:

```json
    "test": "vitest run",
    "test:watch": "vitest",
```

- [ ] **Step 4: Escribir un test de comprobación**

Crea `tests/sanity.test.ts`:

```ts
import { describe, expect, it } from "vitest";

describe("entorno de tests", () => {
  it("ejecuta tests", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Ejecutar y verificar que pasa**

Run: `npm test`
Expected: `1 passed`.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts tests/sanity.test.ts
git commit -m "chore: configurar vitest como runner de tests"
```

---

## Task 2: Normalización de claves

Convierte nombres de artista, canción y álbum en claves estables de agrupación. Sin esto, `Beyoncé` y `Beyonce` son dos artistas distintos en el ranking.

**Files:**
- Create: `src/lib/stats/normalize.ts`
- Test: `tests/normalize.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crea `tests/normalize.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  albumKey,
  artistKey,
  KEY_SEP,
  normalizeName,
  trackKey,
} from "@/lib/stats/normalize";

describe("normalizeName", () => {
  it("pasa a minúsculas", () => {
    expect(normalizeName("Slowdive")).toBe("slowdive");
  });

  it("elimina diacríticos", () => {
    expect(normalizeName("Beyoncé")).toBe("beyonce");
    expect(normalizeName("Beyoncé")).toBe(normalizeName("Beyonce"));
  });

  it("colapsa espacios y recorta", () => {
    expect(normalizeName("  Cocteau   Twins ")).toBe("cocteau twins");
  });

  it("trata igual las formas unicode compuesta y descompuesta", () => {
    // Escritas con escapes a propósito: las dos cadenas se ven idénticas en
    // pantalla y cualquier editor puede normalizarlas, dejando el test vacío.
    const compuesta = "Sigur R\u00F3s"; // ó precompuesta (NFC)
    const descompuesta = "Sigur Ro\u0301s"; // o + acento combinante (NFD)
    expect(compuesta).not.toBe(descompuesta);
    expect(normalizeName(compuesta)).toBe(normalizeName(descompuesta));
  });

  it("devuelve cadena vacía para entrada vacía", () => {
    expect(normalizeName("   ")).toBe("");
  });
});

describe("claves compuestas", () => {
  it("artistKey normaliza el nombre", () => {
    expect(artistKey("Duster")).toBe("duster");
  });

  it("trackKey une artista y título con el separador", () => {
    expect(trackKey("Duster", "Inside Out")).toBe(
      `duster${KEY_SEP}inside out`,
    );
  });

  it("albumKey une artista y álbum con el separador", () => {
    expect(albumKey("Duster", "Stratosphere")).toBe(
      `duster${KEY_SEP}stratosphere`,
    );
  });

  it("no colisiona cuando el título contiene el separador visible", () => {
    // Un título con guiones o barras no debe poder falsear una clave.
    const a = trackKey("Duster", "Inside Out");
    const b = trackKey("Duster - Inside", "Out");
    expect(a).not.toBe(b);
  });

  it("usa un separador no imprimible", () => {
    expect(KEY_SEP).toBe("\u001F");
  });
});
```

- [ ] **Step 2: Ejecutar el test para verificar que falla**

Run: `npm test -- normalize`
Expected: FAIL — `Failed to resolve import "@/lib/stats/normalize"`.

- [ ] **Step 3: Escribir la implementación mínima**

Crea `src/lib/stats/normalize.ts`:

```ts
/**
 * Normalización de nombres a claves de agrupación.
 *
 * Módulo puro: sin `server-only`, sin acceso a base de datos. Se importa tanto
 * desde el servidor como desde los tests.
 */

/**
 * Separador de campos ASCII (unit separator). No imprimible, así que no puede
 * aparecer en un nombre de artista o título y falsear una clave compuesta.
 */
export const KEY_SEP = "\u001F";

/**
 * Minúsculas, sin diacríticos, espacios colapsados.
 *
 * La descomposición NFD separa las marcas diacríticas del carácter base, de
 * modo que `\p{M}` puede eliminarlas: así "Beyoncé" y "Beyonce" —y también las
 * formas compuesta y descompuesta del mismo texto— producen la misma clave.
 */
export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function artistKey(artist: string): string {
  return normalizeName(artist);
}

export function trackKey(artist: string, title: string): string {
  return `${artistKey(artist)}${KEY_SEP}${normalizeName(title)}`;
}

export function albumKey(artist: string, album: string): string {
  return `${artistKey(artist)}${KEY_SEP}${normalizeName(album)}`;
}
```

- [ ] **Step 4: Ejecutar el test para verificar que pasa**

Run: `npm test -- normalize`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stats/normalize.ts tests/normalize.test.ts
git commit -m "feat: normalización de nombres a claves de agrupación"
```

---

## Task 3: Conversión a hora local

Precalcula `local_date` y `local_hour` en la zona horaria configurada. Es el punto donde se decide si los histogramas de "a qué hora escuchas" salen bien o desplazados.

**Files:**
- Create: `src/lib/stats/local-time.ts`
- Test: `tests/local-time.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crea `tests/local-time.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { localParts, resolveTimeZone } from "@/lib/stats/local-time";

describe("localParts", () => {
  it("desplaza al día anterior cuando la hora local va por detrás de UTC", () => {
    // 2019-03-15T03:30:00Z en Lima (UTC-5) son las 22:30 del día 14.
    const ts = Date.UTC(2019, 2, 15, 3, 30, 0);
    expect(localParts(ts, "America/Lima")).toEqual({
      localDate: "2019-03-14",
      localHour: 22,
    });
  });

  it("mantiene el día cuando no hay cruce de medianoche", () => {
    const ts = Date.UTC(2019, 2, 15, 18, 0, 0);
    expect(localParts(ts, "America/Lima")).toEqual({
      localDate: "2019-03-15",
      localHour: 13,
    });
  });

  it("aplica el horario de verano", () => {
    // Madrid: +1 en enero (CET), +2 en julio (CEST).
    const invierno = Date.UTC(2026, 0, 15, 0, 30, 0);
    const verano = Date.UTC(2026, 6, 15, 0, 30, 0);
    expect(localParts(invierno, "Europe/Madrid").localHour).toBe(1);
    expect(localParts(verano, "Europe/Madrid").localHour).toBe(2);
  });

  it("representa la medianoche como hora 0, no 24", () => {
    // Un formateador mal configurado devuelve "24" para medianoche.
    const ts = Date.UTC(2026, 6, 15, 0, 30, 0);
    expect(localParts(ts, "UTC")).toEqual({
      localDate: "2026-07-15",
      localHour: 0,
    });
  });

  it("rellena mes y día con ceros a la izquierda", () => {
    const ts = Date.UTC(2026, 0, 5, 12, 0, 0);
    expect(localParts(ts, "UTC").localDate).toBe("2026-01-05");
  });

  it("rechaza una zona horaria inválida", () => {
    expect(() => localParts(Date.now(), "No/Existe")).toThrow();
  });
});

describe("resolveTimeZone", () => {
  it("devuelve el valor de STATS_TZ", () => {
    expect(resolveTimeZone({ STATS_TZ: "Europe/Madrid" })).toBe(
      "Europe/Madrid",
    );
  });

  it("falla con un mensaje claro si STATS_TZ no está definida", () => {
    // Sin valor por defecto a propósito: una zona equivocada produce datos
    // que parecen correctos y no lo son.
    expect(() => resolveTimeZone({})).toThrow(/STATS_TZ/);
  });

  it("falla si STATS_TZ no es una zona válida", () => {
    expect(() => resolveTimeZone({ STATS_TZ: "No/Existe" })).toThrow(
      /STATS_TZ/,
    );
  });
});
```

- [ ] **Step 2: Ejecutar el test para verificar que falla**

Run: `npm test -- local-time`
Expected: FAIL — `Failed to resolve import "@/lib/stats/local-time"`.

- [ ] **Step 3: Escribir la implementación mínima**

Crea `src/lib/stats/local-time.ts`:

```ts
/**
 * Conversión de instantes UTC a fecha y hora en la zona horaria del usuario.
 *
 * Estos valores se precalculan al insertar cada fila de `streams` porque los
 * histogramas por hora y por día son consultas frecuentes, y convertir al vuelo
 * impediría usar índices. Además el VPS correrá en UTC: depender de la hora
 * local del proceso daría resultados distintos en cada máquina.
 *
 * Módulo puro: sin `server-only`, sin base de datos.
 */

export type LocalParts = { localDate: string; localHour: number };

/**
 * `hourCycle: "h23"` es deliberado: con `hour12: false` algunos entornos
 * devuelven "24" para la medianoche en lugar de "00".
 */
function formatterFor(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  });
}

export function localParts(ts: number, timeZone: string): LocalParts {
  const parts = formatterFor(timeZone).formatToParts(new Date(ts));

  const found: Record<string, string> = {};
  for (const part of parts) found[part.type] = part.value;

  return {
    localDate: `${found.year}-${found.month}-${found.day}`,
    localHour: Number(found.hour),
  };
}

/**
 * Lee y valida `STATS_TZ`. No hay valor por defecto a propósito.
 */
export function resolveTimeZone(env: Record<string, string | undefined>): string {
  const tz = env.STATS_TZ?.trim();
  if (!tz) {
    throw new Error(
      "STATS_TZ no está definida. Añádela a .env.local con una zona IANA, " +
        "p. ej. STATS_TZ=Europe/Madrid",
    );
  }
  try {
    formatterFor(tz).format(new Date());
  } catch {
    throw new Error(`STATS_TZ no es una zona horaria IANA válida: "${tz}"`);
  }
  return tz;
}
```

- [ ] **Step 4: Ejecutar el test para verificar que pasa**

Run: `npm test -- local-time`
Expected: PASS, 9 tests.

Los dos tests de zona inválida (`localParts` y `resolveTimeZone`) dependen de que `Intl.DateTimeFormat` lance `RangeError` ante una zona desconocida, que es el comportamiento especificado por ECMA-402 y el de Node 20+.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stats/local-time.ts tests/local-time.test.ts
git commit -m "feat: conversión de instantes UTC a fecha y hora local"
```

---

## Task 4: Rangos de fechas

> ⚠️ **Superada por la Task 17.** Esta tarea se implementó tal cual (commit `424fec7`) y la revisión de código encontró tres defectos: un fallo de cadena de prototipos, y dos problemas de diseño —límites en UTC contra datos en hora local, y presets rodantes contra rangos alineados a día—. La Task 17 la rehace sobre fechas locales. Se conserva aquí como registro de lo que se construyó y por qué cambió; **no la implementes de nuevo.**

**Files:**
- Create: `src/lib/stats/range.ts`
- Test: `tests/range.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crea `tests/range.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseRange, PRESETS, type StatsRange } from "@/lib/stats/range";

const AHORA = Date.UTC(2026, 6, 27, 12, 0, 0); // 2026-07-27T12:00:00Z

describe("parseRange", () => {
  it("por defecto devuelve las últimas 4 semanas", () => {
    const r = parseRange({}, AHORA);
    expect(r.to).toBe(AHORA);
    expect(r.from).toBe(AHORA - 28 * 24 * 60 * 60 * 1000);
    expect(r.preset).toBe("4w");
  });

  it("resuelve el preset de 6 meses", () => {
    const r = parseRange({ preset: "6m" }, AHORA);
    expect(r.from).toBe(AHORA - 182 * 24 * 60 * 60 * 1000);
    expect(r.preset).toBe("6m");
  });

  it("el preset histórico empieza en el epoch", () => {
    const r = parseRange({ preset: "all" }, AHORA);
    expect(r.from).toBe(0);
    expect(r.to).toBe(AHORA);
  });

  it("acepta un rango explícito", () => {
    const r = parseRange({ desde: "2019-03-01", hasta: "2019-07-31" }, AHORA);
    expect(r.from).toBe(Date.UTC(2019, 2, 1, 0, 0, 0, 0));
    // `hasta` es inclusivo: cubre hasta el último milisegundo del día.
    expect(r.to).toBe(Date.UTC(2019, 6, 31, 23, 59, 59, 999));
    expect(r.preset).toBe("custom");
  });

  it("un rango explícito tiene prioridad sobre el preset", () => {
    const r = parseRange(
      { preset: "6m", desde: "2019-03-01", hasta: "2019-03-31" },
      AHORA,
    );
    expect(r.preset).toBe("custom");
  });

  it("intercambia las fechas si vienen al revés", () => {
    const r = parseRange({ desde: "2019-07-31", hasta: "2019-03-01" }, AHORA);
    expect(r.from).toBeLessThan(r.to);
  });

  it("cae al preset por defecto si las fechas son inválidas", () => {
    const r = parseRange({ desde: "no-es-fecha", hasta: "tampoco" }, AHORA);
    expect(r.preset).toBe("4w");
  });

  it("cae al preset por defecto si el preset no existe", () => {
    const r = parseRange({ preset: "inventado" }, AHORA);
    expect(r.preset).toBe("4w");
  });

  it("ignora un rango con solo una de las dos fechas", () => {
    const r = parseRange({ desde: "2019-03-01" }, AHORA);
    expect(r.preset).toBe("4w");
  });

  it("produce una etiqueta legible", () => {
    const r: StatsRange = parseRange({ preset: "6m" }, AHORA);
    expect(r.label).toBe(PRESETS["6m"].label);
  });
});
```

- [ ] **Step 2: Ejecutar el test para verificar que falla**

Run: `npm test -- range`
Expected: FAIL — `Failed to resolve import "@/lib/stats/range"`.

- [ ] **Step 3: Escribir la implementación mínima**

Crea `src/lib/stats/range.ts`:

```ts
/**
 * Resolución de rangos temporales.
 *
 * Todas las consultas de estadísticas reciben un `StatsRange`. Los presets y el
 * rango libre producen la misma estructura, así que "mis top artistas entre
 * marzo y julio de 2019" no es un caso especial: es el caso general con otras
 * fechas.
 *
 * Módulo puro: sin `server-only`, sin base de datos.
 */

export type PresetId = "4w" | "6m" | "year" | "all";

export type StatsRange = {
  from: number;
  to: number;
  label: string;
  preset: PresetId | "custom";
};

const DIA_MS = 24 * 60 * 60 * 1000;

export const PRESETS: Record<PresetId, { label: string; days: number | null }> = {
  "4w": { label: "Últimas 4 semanas", days: 28 },
  "6m": { label: "Últimos 6 meses", days: 182 },
  year: { label: "Último año", days: 365 },
  all: { label: "Histórico", days: null },
};

const PRESET_POR_DEFECTO: PresetId = "4w";

export type RangeParams = {
  preset?: string;
  desde?: string;
  hasta?: string;
};

/** Convierte 'YYYY-MM-DD' a epoch ms UTC. Devuelve null si no es válida. */
function parseDia(valor: string, finDelDia: boolean): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor.trim());
  if (!m) return null;

  const [, y, mes, d] = m;
  const ts = finDelDia
    ? Date.UTC(Number(y), Number(mes) - 1, Number(d), 23, 59, 59, 999)
    : Date.UTC(Number(y), Number(mes) - 1, Number(d), 0, 0, 0, 0);

  return Number.isNaN(ts) ? null : ts;
}

function desdePreset(preset: PresetId, ahora: number): StatsRange {
  const { label, days } = PRESETS[preset];
  return {
    from: days === null ? 0 : ahora - days * DIA_MS,
    to: ahora,
    label,
    preset,
  };
}

/**
 * Un rango explícito (ambas fechas válidas) tiene prioridad sobre el preset.
 * Cualquier entrada inválida cae al preset por defecto en vez de lanzar: estos
 * valores vienen de la URL y el usuario puede escribir cualquier cosa.
 */
export function parseRange(params: RangeParams, ahora: number): StatsRange {
  if (params.desde && params.hasta) {
    const a = parseDia(params.desde, false);
    const b = parseDia(params.hasta, true);

    if (a !== null && b !== null) {
      const from = Math.min(a, b);
      const to = Math.max(a, b);
      return {
        from,
        to,
        label: `${params.desde} → ${params.hasta}`,
        preset: "custom",
      };
    }
  }

  const preset = params.preset;
  if (preset && preset in PRESETS) {
    return desdePreset(preset as PresetId, ahora);
  }

  return desdePreset(PRESET_POR_DEFECTO, ahora);
}
```

- [ ] **Step 4: Ejecutar el test para verificar que pasa**

Run: `npm test -- range`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stats/range.ts tests/range.test.ts
git commit -m "feat: resolución de rangos temporales con presets y rango libre"
```

---

## Task 5: Extraer el DDL a su propio módulo

Prerrequisito de las tablas nuevas: los tests necesitan crear el mismo esquema en memoria, y duplicar el DDL garantizaría que producción y tests diverjan.

**Files:**
- Create: `src/db/schema-sql.ts`
- Modify: `src/db/index.ts:22-71`

- [ ] **Step 1: Crear el módulo con el DDL actual**

Crea `src/db/schema-sql.ts` con exactamente el DDL que hoy vive en `src/db/index.ts`:

```ts
/**
 * DDL del esquema, como constante.
 *
 * Vive aparte de `index.ts` para que los tests puedan construir una base en
 * memoria con el mismo esquema exacto que producción. Duplicarlo garantizaría
 * que los dos diverjan.
 *
 * Idempotente: se ejecuta en cada arranque.
 */
export const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS artists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    genres TEXT NOT NULL DEFAULT '[]',
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS artists_updated_at ON artists(updated_at);

  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT 'acid',
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS track_tags (
    track_uri TEXT NOT NULL,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    added_at INTEGER NOT NULL,
    PRIMARY KEY (track_uri, tag_id)
  );
  CREATE INDEX IF NOT EXISTS track_tags_tag_idx ON track_tags(tag_id);

  CREATE TABLE IF NOT EXISTS liked_tracks (
    uri TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    artists_json TEXT NOT NULL,
    album_id TEXT,
    album_name TEXT,
    album_image TEXT,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    explicit INTEGER NOT NULL DEFAULT 0,
    added_at TEXT,
    scanned_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS liked_tracks_added_at_idx ON liked_tracks(added_at);

  CREATE TABLE IF NOT EXISTS smart_playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    rules_json TEXT NOT NULL DEFAULT '{}',
    spotify_playlist_id TEXT,
    last_synced_at INTEGER,
    last_sync_count INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
`;
```

- [ ] **Step 2: Usarlo desde `index.ts`**

En `src/db/index.ts`, añade el import junto a los existentes:

```ts
import { SCHEMA_SQL } from "./schema-sql";
```

y sustituye todo el bloque `sqlite.exec(\`…\`);` (líneas 22-71) por:

```ts
  // Auto-create tables on first run. Idempotent.
  sqlite.exec(SCHEMA_SQL);
```

- [ ] **Step 3: Verificar que la app sigue arrancando**

Run: `npm run dev`
Expected: arranca sin errores. Abre `http://127.0.0.1:3000` y comprueba que carga. Detén el servidor.

- [ ] **Step 4: Verificar que compila y el lint pasa**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/db/schema-sql.ts src/db/index.ts
git commit -m "refactor: extraer el DDL a src/db/schema-sql.ts"
```

---

## Task 6: Tablas nuevas

**Files:**
- Modify: `src/db/schema-sql.ts`
- Modify: `src/db/schema.ts`
- Create: `tests/helpers/test-db.ts`
- Test: `tests/schema.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crea primero el helper `tests/helpers/test-db.ts`:

```ts
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@/db/schema";
import { SCHEMA_SQL } from "@/db/schema-sql";

/**
 * Base en memoria con el mismo esquema que producción. Cada test crea la suya,
 * así que no comparten estado.
 */
export function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(SCHEMA_SQL);
  return { db: drizzle(sqlite, { schema }), sqlite };
}
```

Crea `tests/schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createTestDb } from "./helpers/test-db";

function tablas(sqlite: ReturnType<typeof createTestDb>["sqlite"]): string[] {
  const filas = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all() as { name: string }[];
  return filas.map((f) => f.name);
}

describe("esquema", () => {
  it("crea las tablas nuevas", () => {
    const { sqlite } = createTestDb();
    const nombres = tablas(sqlite);
    expect(nombres).toContain("streams");
    expect(nombres).toContain("spotify_credentials");
    expect(nombres).toContain("capture_state");
    expect(nombres).toContain("import_batches");
    expect(nombres).toContain("artist_resolution");
    expect(nombres).toContain("top_snapshots");
  });

  it("conserva las tablas existentes", () => {
    const { sqlite } = createTestDb();
    const nombres = tablas(sqlite);
    expect(nombres).toContain("artists");
    expect(nombres).toContain("tags");
    expect(nombres).toContain("liked_tracks");
    expect(nombres).toContain("smart_playlists");
  });

  it("rechaza dos streams con el mismo dedup_key", () => {
    const { sqlite } = createTestDb();
    const insertar = sqlite.prepare(`
      INSERT INTO streams
        (ts, ms_played, track_name, artist_name, track_key, artist_key,
         local_date, local_hour, source, dedup_key)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const fila = [
      1_700_000_000_000, 210_000, "Alison", "Slowdive",
      "slowdive\u001Falison", "slowdive", "2023-11-14", 15, "live", "clave-1",
    ];

    insertar.run(...fila);
    expect(() => insertar.run(...fila)).toThrow(/UNIQUE/);
  });

  it("permite varias filas de spotify_credentials solo con id = 1", () => {
    const { sqlite } = createTestDb();
    const insertar = sqlite.prepare(`
      INSERT INTO spotify_credentials (id, spotify_user_id, refresh_token, updated_at)
      VALUES (?, ?, ?, ?)
    `);
    insertar.run(1, "usuario", "token", Date.now());
    expect(() => insertar.run(2, "otro", "token", Date.now())).toThrow(/CHECK/);
  });
});
```

- [ ] **Step 2: Ejecutar el test para verificar que falla**

Run: `npm test -- schema`
Expected: FAIL — `expected [ ... ] to contain 'streams'`.

- [ ] **Step 3: Añadir el DDL de las tablas nuevas**

Al final de la plantilla `SCHEMA_SQL` en `src/db/schema-sql.ts`, justo antes del backtick de cierre, añade:

```sql
  CREATE TABLE IF NOT EXISTS streams (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    ts            INTEGER NOT NULL,
    ms_played     INTEGER NOT NULL,
    track_uri     TEXT,
    track_name    TEXT NOT NULL,
    artist_name   TEXT NOT NULL,
    album_name    TEXT,
    track_key     TEXT NOT NULL,
    artist_key    TEXT NOT NULL,
    album_key     TEXT,
    local_date    TEXT NOT NULL,
    local_hour    INTEGER NOT NULL,
    reason_start  TEXT,
    reason_end    TEXT,
    shuffle       INTEGER,
    skipped       INTEGER,
    platform      TEXT,
    source        TEXT NOT NULL,
    dedup_key     TEXT NOT NULL UNIQUE
  );
  CREATE INDEX IF NOT EXISTS streams_ts_idx         ON streams(ts);
  CREATE INDEX IF NOT EXISTS streams_artist_idx     ON streams(artist_key, ts);
  CREATE INDEX IF NOT EXISTS streams_track_idx      ON streams(track_key, ts);
  CREATE INDEX IF NOT EXISTS streams_album_idx      ON streams(album_key, ts);
  CREATE INDEX IF NOT EXISTS streams_local_date_idx ON streams(local_date);
  CREATE INDEX IF NOT EXISTS streams_local_hour_idx ON streams(local_hour);
  CREATE INDEX IF NOT EXISTS streams_source_ts_idx  ON streams(source, ts);

  CREATE TABLE IF NOT EXISTS spotify_credentials (
    id               INTEGER PRIMARY KEY CHECK (id = 1),
    spotify_user_id  TEXT NOT NULL,
    refresh_token    TEXT NOT NULL,
    access_token     TEXT,
    expires_at       INTEGER,
    updated_at       INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS capture_state (
    id                INTEGER PRIMARY KEY CHECK (id = 1),
    last_played_at    INTEGER,
    last_run_at       INTEGER,
    last_run_status   TEXT,
    last_run_inserted INTEGER,
    last_error        TEXT,
    gap_suspected_at  INTEGER
  );

  CREATE TABLE IF NOT EXISTS import_batches (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    filename      TEXT NOT NULL,
    file_hash     TEXT,
    format        TEXT,
    rows_read     INTEGER,
    rows_inserted INTEGER,
    rows_skipped  INTEGER,
    rows_invalid  INTEGER,
    range_start   INTEGER,
    range_end     INTEGER,
    imported_at   INTEGER NOT NULL,
    status        TEXT
  );

  CREATE TABLE IF NOT EXISTS artist_resolution (
    artist_key        TEXT PRIMARY KEY,
    spotify_artist_id TEXT,
    image_url         TEXT,
    resolved_at       INTEGER,
    attempts          INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS top_snapshots (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    taken_at     INTEGER NOT NULL,
    time_range   TEXT NOT NULL,
    entity       TEXT NOT NULL,
    payload_json TEXT NOT NULL
  );
```

- [ ] **Step 4: Añadir los esquemas Drizzle**

Al final de `src/db/schema.ts`, añade:

```ts
/** Fuente única de escuchas. Alimentada por la captura vía API y por el dump. */
export const streams = sqliteTable(
  "streams",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** Epoch ms UTC — fin de la reproducción. */
    ts: integer("ts").notNull(),
    msPlayed: integer("ms_played").notNull(),
    /** NULL en pistas locales y en el dump básico. */
    trackUri: text("track_uri"),
    trackName: text("track_name").notNull(),
    artistName: text("artist_name").notNull(),
    albumName: text("album_name"),
    trackKey: text("track_key").notNull(),
    artistKey: text("artist_key").notNull(),
    albumKey: text("album_key"),
    /** 'YYYY-MM-DD' en STATS_TZ. */
    localDate: text("local_date").notNull(),
    /** 0-23 en STATS_TZ. */
    localHour: integer("local_hour").notNull(),
    reasonStart: text("reason_start"),
    reasonEnd: text("reason_end"),
    shuffle: integer("shuffle"),
    skipped: integer("skipped"),
    platform: text("platform"),
    /** 'live' | 'import'. */
    source: text("source").notNull(),
    dedupKey: text("dedup_key").notNull().unique(),
  },
  (t) => ({
    byTs: index("streams_ts_idx").on(t.ts),
    byArtist: index("streams_artist_idx").on(t.artistKey, t.ts),
    byTrack: index("streams_track_idx").on(t.trackKey, t.ts),
    byAlbum: index("streams_album_idx").on(t.albumKey, t.ts),
    byLocalDate: index("streams_local_date_idx").on(t.localDate),
    byLocalHour: index("streams_local_hour_idx").on(t.localHour),
    bySourceTs: index("streams_source_ts_idx").on(t.source, t.ts),
  }),
);

export type StreamRow = typeof streams.$inferSelect;
export type NewStreamRow = typeof streams.$inferInsert;

/** Fila única (id = 1) con el refresh token, para que el cron funcione sin sesión. */
export const spotifyCredentials = sqliteTable("spotify_credentials", {
  id: integer("id").primaryKey(),
  spotifyUserId: text("spotify_user_id").notNull(),
  refreshToken: text("refresh_token").notNull(),
  accessToken: text("access_token"),
  expiresAt: integer("expires_at"),
  updatedAt: integer("updated_at").notNull(),
});

export type SpotifyCredentialsRow = typeof spotifyCredentials.$inferSelect;

/** Fila única (id = 1) con el cursor y la salud de la captura. */
export const captureState = sqliteTable("capture_state", {
  id: integer("id").primaryKey(),
  lastPlayedAt: integer("last_played_at"),
  lastRunAt: integer("last_run_at"),
  /** 'ok' | 'error' | 'gap'. */
  lastRunStatus: text("last_run_status"),
  lastRunInserted: integer("last_run_inserted"),
  lastError: text("last_error"),
  gapSuspectedAt: integer("gap_suspected_at"),
});

export type CaptureStateRow = typeof captureState.$inferSelect;

/** Un registro por archivo del dump importado. */
export const importBatches = sqliteTable("import_batches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  filename: text("filename").notNull(),
  fileHash: text("file_hash"),
  /** 'extended' | 'basic'. */
  format: text("format"),
  rowsRead: integer("rows_read"),
  rowsInserted: integer("rows_inserted"),
  rowsSkipped: integer("rows_skipped"),
  rowsInvalid: integer("rows_invalid"),
  rangeStart: integer("range_start"),
  rangeEnd: integer("range_end"),
  importedAt: integer("imported_at").notNull(),
  status: text("status"),
});

export type ImportBatchRow = typeof importBatches.$inferSelect;

/** Puente entre los nombres del dump y los IDs de artista de Spotify. */
export const artistResolution = sqliteTable("artist_resolution", {
  artistKey: text("artist_key").primaryKey(),
  spotifyArtistId: text("spotify_artist_id"),
  imageUrl: text("image_url"),
  resolvedAt: integer("resolved_at"),
  attempts: integer("attempts").notNull().default(0),
});

export type ArtistResolutionRow = typeof artistResolution.$inferSelect;

/** Foto periódica de los tops precalculados por Spotify. No son escuchas. */
export const topSnapshots = sqliteTable("top_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  takenAt: integer("taken_at").notNull(),
  /** 'short_term' | 'medium_term' | 'long_term'. */
  timeRange: text("time_range").notNull(),
  /** 'artists' | 'tracks'. */
  entity: text("entity").notNull(),
  payloadJson: text("payload_json").notNull(),
});

export type TopSnapshotRow = typeof topSnapshots.$inferSelect;
```

- [ ] **Step 5: Ejecutar el test para verificar que pasa**

Run: `npm test -- schema`
Expected: PASS, 4 tests.

- [ ] **Step 6: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add src/db/schema-sql.ts src/db/schema.ts tests/schema.test.ts tests/helpers/test-db.ts
git commit -m "feat: tablas de streams, credenciales, captura, imports y snapshots"
```

---

## Task 7: Extraer el núcleo de spotifyFetch

Separa la lógica HTTP del origen del token. Es lo que permite que un cron sin cookie use exactamente el mismo rate limiter y el mismo backoff.

**Files:**
- Create: `src/lib/spotify-core.ts`
- Modify: `src/lib/spotify.ts:1-73`

- [ ] **Step 1: Crear el núcleo**

Crea `src/lib/spotify-core.ts` moviendo el cuerpo actual de `spotifyFetch`, con el token como parámetro:

```ts
import "server-only";
import { spotifyLimiter } from "./rate-limiter";

const SPOTIFY_API = "https://api.spotify.com/v1";

/**
 * Núcleo HTTP contra la Web API: rate limiter global, backoff y reintentos.
 *
 * Recibe el access token como argumento en vez de leerlo de la sesión, de modo
 * que sirve tanto a las peticiones con sesión (`spotifyFetch`) como a las del
 * cron sin cookie (`spotifyFetchHeadless`). Sin esta separación, la lógica de
 * reintentos habría que duplicarla.
 */
export async function spotifyRequest<T>(
  accessToken: string,
  path: string,
  init: RequestInit = {},
  attempt = 0,
): Promise<T> {
  const isMutation = init.method && init.method !== "GET";
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string>),
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
    "User-Agent": "ledger-app/0.1 (personal-use)",
  };
  if (isMutation) headers["Content-Type"] = "application/json";

  // Wait for the global rate limiter — guarantees we never exceed Spotify's
  // 180 req/30s cap regardless of how many scanners run in parallel.
  await spotifyLimiter.acquire();

  const res = await fetch(`${SPOTIFY_API}${path}`, { ...init, headers });

  // Retry on 429 always; retry 5xx only for idempotent methods. A POST (add
  // tracks, create playlist) may have been partially processed before the 5xx,
  // so retrying it could duplicate tracks or create duplicate playlists.
  const method = (init.method ?? "GET").toUpperCase();
  const isIdempotent = method === "GET" || method === "PUT" || method === "DELETE";
  const canRetry = res.status === 429 || (res.status >= 500 && isIdempotent);
  if (canRetry && attempt < 4) {
    const parsedRetryAfter = parseInt(res.headers.get("Retry-After") ?? "", 10);
    // A non-numeric Retry-After (e.g. HTTP-date) must not become NaN, or the
    // backoff collapses to setTimeout(NaN) === 0ms (hammering on retry).
    const retryAfterSec = Number.isFinite(parsedRetryAfter) ? parsedRetryAfter : 0;
    // If Spotify wants us to wait more than 60s, give up and let the user know.
    const MAX_AUTO_WAIT_S = 60;
    if (retryAfterSec > MAX_AUTO_WAIT_S) {
      const minutes = Math.ceil(retryAfterSec / 60);
      const err = new Error(
        `Spotify rate limit: ${minutes} min de espera. Intenta más tarde.`,
      ) as Error & { status?: number; retryAfterSec?: number };
      err.status = 429;
      err.retryAfterSec = retryAfterSec;
      throw err;
    }
    const backoffMs = Math.max(
      retryAfterSec * 1000,
      Math.min(30_000, 500 * 2 ** attempt),
    );
    console.warn(
      `[spotify] ${res.status} on ${path}. Retrying in ${backoffMs}ms (attempt ${attempt + 1}/4)…`,
    );
    await new Promise((r) => setTimeout(r, backoffMs));
    return spotifyRequest<T>(accessToken, path, init, attempt + 1);
  }

  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`Spotify ${res.status}: ${text}`) as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
```

- [ ] **Step 2: Adelgazar `spotify.ts`**

En `src/lib/spotify.ts`, sustituye las líneas 1-73 (los imports, la constante `SPOTIFY_API` y toda la función `spotifyFetch`) por:

```ts
import { auth } from "@/auth";
import { spotifyRequest } from "./spotify-core";

/**
 * Petición autenticada con la sesión del navegador.
 *
 * La firma no cambia: todos los consumidores actuales siguen funcionando igual.
 * Lo único que se movió es el cuerpo, a `spotify-core`.
 */
export async function spotifyFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const session = await auth();
  if (!session?.accessToken) throw new Error("Not authenticated");
  return spotifyRequest<T>(session.accessToken, path, init);
}
```

El resto del archivo (tipos y funciones `getMe`, `getMyPlaylists`, etc., desde la línea 75 en adelante) queda intacto.

- [ ] **Step 3: Verificar que nada se rompió**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 4: Verificar en la app**

Run: `npm run dev`

Abre `http://127.0.0.1:3000` y comprueba que el listado de playlists sigue cargando, y `http://127.0.0.1:3000/debug` que las sondas siguen en verde. Detén el servidor.

Expected: comportamiento idéntico al anterior.

- [ ] **Step 5: Commit**

```bash
git add src/lib/spotify-core.ts src/lib/spotify.ts
git commit -m "refactor: extraer el núcleo HTTP de Spotify a spotify-core"
```

---

## Task 8: Persistencia de credenciales

**Files:**
- Create: `src/lib/credentials.ts`
- Modify: `src/auth.ts:93-120`

- [ ] **Step 1: Crear el módulo de credenciales**

Crea `src/lib/credentials.ts`:

```ts
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { spotifyCredentials, type SpotifyCredentialsRow } from "@/db/schema";

/** La tabla tiene una sola fila, con id fijo. */
const FILA = 1;

export type CredentialsInput = {
  spotifyUserId: string;
  refreshToken: string;
  accessToken?: string | null;
  expiresAt?: number | null;
};

/**
 * Guarda (o reemplaza) las credenciales. Se llama al iniciar sesión por
 * navegador; es lo que permite que el cron opere después sin cookie.
 */
export async function saveCredentials(input: CredentialsInput): Promise<void> {
  const now = Date.now();
  await db
    .insert(spotifyCredentials)
    .values({
      id: FILA,
      spotifyUserId: input.spotifyUserId,
      refreshToken: input.refreshToken,
      accessToken: input.accessToken ?? null,
      expiresAt: input.expiresAt ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: spotifyCredentials.id,
      set: {
        spotifyUserId: input.spotifyUserId,
        refreshToken: input.refreshToken,
        accessToken: input.accessToken ?? null,
        expiresAt: input.expiresAt ?? null,
        updatedAt: now,
      },
    });
}

export async function getCredentials(): Promise<SpotifyCredentialsRow | null> {
  const filas = await db
    .select()
    .from(spotifyCredentials)
    .where(eq(spotifyCredentials.id, FILA))
    .limit(1);
  return filas[0] ?? null;
}

/** Actualiza solo el access token tras un refresco. */
export async function updateAccessToken(
  accessToken: string,
  expiresAt: number,
  refreshToken?: string,
): Promise<void> {
  await db
    .update(spotifyCredentials)
    .set({
      accessToken,
      expiresAt,
      ...(refreshToken ? { refreshToken } : {}),
      updatedAt: Date.now(),
    })
    .where(eq(spotifyCredentials.id, FILA));
}
```

- [ ] **Step 2: Sembrar las credenciales al iniciar sesión**

En `src/auth.ts`, dentro de `callbacks`, sustituye el bloque `if (account) { … }` del callback `jwt` (líneas 95-100) por:

```ts
    async jwt({ token, account, profile }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = (account.expires_at ?? 0) * 1000;

        // Persistir el refresh token para que el cron pueda operar sin cookie.
        // El import es dinámico a propósito: `@/db` arrastra better-sqlite3
        // (módulo nativo) y no debe acabar en ningún bundle que no sea Node.
        // Un fallo aquí no debe impedir el login: la app sigue funcionando por
        // navegador y /ajustes avisará de que la captura no está configurada.
        if (account.refresh_token) {
          try {
            const { saveCredentials } = await import("@/lib/credentials");
            await saveCredentials({
              spotifyUserId: (profile as { id?: string } | undefined)?.id ?? "me",
              refreshToken: account.refresh_token,
              accessToken: account.access_token ?? null,
              expiresAt: (account.expires_at ?? 0) * 1000,
            });
          } catch (e) {
            console.error("[auth] no se pudieron guardar las credenciales", e);
          }
        }

        return token;
      }
```

El resto del callback (el refresco y el manejo de error) queda igual.

- [ ] **Step 3: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 4: Verificar que la siembra ocurre**

Run: `npm run dev`

Cierra sesión y vuelve a entrar en `http://127.0.0.1:3000` (la siembra solo ocurre en el login, cuando llega `account`). Después:

```bash
npx drizzle-kit studio
```

Expected: la tabla `spotify_credentials` tiene exactamente una fila, con `refresh_token` no vacío.

Alternativa sin studio:

```bash
node -e "const D=require('better-sqlite3');const d=new D('data/ledger.db');console.log(d.prepare('SELECT id, spotify_user_id, length(refresh_token) AS len FROM spotify_credentials').all())"
```

Expected: una fila con `len` mayor que 0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/credentials.ts src/auth.ts
git commit -m "feat: persistir el refresh token para operar sin sesión"
```

---

## Task 9: Cliente HTTP sin sesión

**Files:**
- Create: `src/lib/spotify-headless.ts`

- [ ] **Step 1: Escribir la implementación**

Crea `src/lib/spotify-headless.ts`:

```ts
import "server-only";
import { spotifyRequest } from "./spotify-core";
import { getCredentials, updateAccessToken } from "./credentials";

/** Margen antes de la expiración para no usar un token a punto de caducar. */
const MARGEN_MS = 60_000;

/** Lanzado cuando no hay credenciales guardadas: hay que entrar por navegador. */
export class SinCredencialesError extends Error {
  constructor() {
    super(
      "No hay credenciales guardadas. Inicia sesión en la app desde el navegador " +
        "para habilitar la captura en segundo plano.",
    );
    this.name = "SinCredencialesError";
  }
}

/** Lanzado cuando Spotify rechaza el refresh token (revocado o inválido). */
export class TokenRevocadoError extends Error {
  constructor(detalle: string) {
    super(`El refresh token fue rechazado por Spotify: ${detalle}`);
    this.name = "TokenRevocadoError";
  }
}

async function refrescar(refreshToken: string): Promise<string> {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(
          `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`,
        ).toString("base64"),
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  const cuerpo = await res.text();
  if (!res.ok) {
    // invalid_grant significa token revocado: no tiene sentido reintentar.
    if (res.status === 400 && cuerpo.includes("invalid_grant")) {
      throw new TokenRevocadoError(cuerpo);
    }
    throw new Error(`Fallo al refrescar el token: ${res.status} ${cuerpo}`);
  }

  const datos = JSON.parse(cuerpo) as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
  };

  await updateAccessToken(
    datos.access_token,
    Date.now() + datos.expires_in * 1000,
    datos.refresh_token,
  );

  return datos.access_token;
}

async function accessToken(): Promise<string> {
  const cred = await getCredentials();
  if (!cred) throw new SinCredencialesError();

  if (cred.accessToken && cred.expiresAt && Date.now() < cred.expiresAt - MARGEN_MS) {
    return cred.accessToken;
  }

  return refrescar(cred.refreshToken);
}

/**
 * Petición a la Web API sin sesión de navegador, para el cron.
 *
 * Comparte con `spotifyFetch` todo el rate limiting y el backoff: lo único que
 * cambia es de dónde sale el token.
 */
export async function spotifyFetchHeadless<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  return spotifyRequest<T>(await accessToken(), path, init);
}
```

- [ ] **Step 2: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/lib/spotify-headless.ts
git commit -m "feat: cliente de Spotify sin sesión, con refresco de token"
```

---

## Task 10: Conversión de recently-played a filas de streams

Función pura: recibe la respuesta de la API y devuelve filas listas para insertar. Al no tocar red ni base de datos, se puede probar exhaustivamente.

**Files:**
- Create: `src/lib/capture/map-recently-played.ts`
- Test: `tests/map-recently-played.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crea `tests/map-recently-played.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  mapRecentlyPlayed,
  type RecentlyPlayedItem,
} from "@/lib/capture/map-recently-played";

function item(over: Partial<RecentlyPlayedItem> = {}): RecentlyPlayedItem {
  return {
    played_at: "2026-07-15T18:30:00.000Z",
    track: {
      uri: "spotify:track:abc",
      name: "Alison",
      duration_ms: 216_000,
      artists: [{ id: "a1", name: "Slowdive" }],
      album: { id: "al1", name: "Souvlaki" },
    },
    ...over,
  };
}

describe("mapRecentlyPlayed", () => {
  it("convierte un item en una fila de stream", () => {
    const [fila] = mapRecentlyPlayed([item()], "UTC");

    expect(fila.ts).toBe(Date.UTC(2026, 6, 15, 18, 30, 0));
    expect(fila.trackName).toBe("Alison");
    expect(fila.artistName).toBe("Slowdive");
    expect(fila.albumName).toBe("Souvlaki");
    expect(fila.trackUri).toBe("spotify:track:abc");
    expect(fila.source).toBe("live");
  });

  it("normaliza las claves de agrupación", () => {
    const [fila] = mapRecentlyPlayed([item()], "UTC");
    expect(fila.artistKey).toBe("slowdive");
    expect(fila.trackKey).toBe("slowdive\u001Falison");
    expect(fila.albumKey).toBe("slowdive\u001Fsouvlaki");
  });

  it("calcula la fecha y hora local", () => {
    const [fila] = mapRecentlyPlayed([item()], "America/Lima");
    expect(fila.localDate).toBe("2026-07-15");
    expect(fila.localHour).toBe(13);
  });

  it("usa la duración completa como ms_played", () => {
    // recently-played no informa de cuánto sonó. Es una sobreestimación
    // acotada y temporal: el dump reemplazará este rango con datos exactos.
    const [fila] = mapRecentlyPlayed([item()], "UTC");
    expect(fila.msPlayed).toBe(216_000);
  });

  it("deja a null los campos que la API no proporciona", () => {
    const [fila] = mapRecentlyPlayed([item()], "UTC");
    expect(fila.skipped).toBeNull();
    expect(fila.reasonStart).toBeNull();
    expect(fila.reasonEnd).toBeNull();
    expect(fila.shuffle).toBeNull();
  });

  it("construye el dedup_key con el timestamp y el uri", () => {
    const [fila] = mapRecentlyPlayed([item()], "UTC");
    expect(fila.dedupKey).toBe(`${Date.UTC(2026, 6, 15, 18, 30, 0)}:spotify:track:abc`);
  });

  it("usa track_key en el dedup_key cuando no hay uri", () => {
    const sinUri = item({
      track: { ...item().track!, uri: "" },
    });
    const [fila] = mapRecentlyPlayed([sinUri], "UTC");
    expect(fila.trackUri).toBeNull();
    expect(fila.dedupKey).toBe(
      `${Date.UTC(2026, 6, 15, 18, 30, 0)}:slowdive\u001Falison`,
    );
  });

  it("acepta la clave `item` además de `track`", () => {
    // El fork de feb 2026 renombró `track` a `item` en playlists; se admiten
    // las dos formas por si recently-played sigue el mismo camino.
    const conItem: RecentlyPlayedItem = {
      played_at: "2026-07-15T18:30:00.000Z",
      item: item().track,
    };
    const [fila] = mapRecentlyPlayed([conItem], "UTC");
    expect(fila.trackName).toBe("Alison");
  });

  it("descarta items sin pista", () => {
    const vacio: RecentlyPlayedItem = { played_at: "2026-07-15T18:30:00.000Z" };
    expect(mapRecentlyPlayed([vacio], "UTC")).toHaveLength(0);
  });

  it("descarta items con fecha inválida", () => {
    expect(mapRecentlyPlayed([item({ played_at: "no-es-fecha" })], "UTC")).toHaveLength(0);
  });

  it("usa el primer artista cuando hay varios", () => {
    const varios = item({
      track: {
        ...item().track!,
        artists: [
          { id: "a1", name: "Slowdive" },
          { id: "a2", name: "Mojave 3" },
        ],
      },
    });
    const [fila] = mapRecentlyPlayed([varios], "UTC");
    expect(fila.artistName).toBe("Slowdive");
  });

  it("tolera un item sin artistas", () => {
    const sinArtistas = item({ track: { ...item().track!, artists: [] } });
    expect(mapRecentlyPlayed([sinArtistas], "UTC")).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Ejecutar el test para verificar que falla**

Run: `npm test -- map-recently-played`
Expected: FAIL — `Failed to resolve import "@/lib/capture/map-recently-played"`.

- [ ] **Step 3: Escribir la implementación mínima**

Crea `src/lib/capture/map-recently-played.ts`:

```ts
/**
 * Conversión de la respuesta de /me/player/recently-played a filas `streams`.
 *
 * Módulo puro: sin red, sin base de datos, sin `server-only`.
 */
import type { NewStreamRow } from "@/db/schema";
import { albumKey, artistKey, trackKey } from "@/lib/stats/normalize";
import { localParts } from "@/lib/stats/local-time";

export type RecentlyPlayedTrack = {
  uri: string;
  name: string;
  duration_ms: number;
  artists: { id: string; name: string }[];
  album: { id: string; name: string } | null;
};

export type RecentlyPlayedItem = {
  played_at: string;
  /** El fork de feb 2026 renombró `track` a `item` en playlists. */
  track?: RecentlyPlayedTrack | null;
  item?: RecentlyPlayedTrack | null;
};

export type RecentlyPlayedResponse = {
  items: RecentlyPlayedItem[];
  cursors?: { after?: string; before?: string } | null;
};

export function mapRecentlyPlayed(
  items: RecentlyPlayedItem[],
  timeZone: string,
): NewStreamRow[] {
  const filas: NewStreamRow[] = [];

  for (const entrada of items) {
    const pista = entrada.item ?? entrada.track;
    if (!pista) continue;

    const artista = pista.artists?.[0]?.name;
    if (!artista || !pista.name) continue;

    const ts = Date.parse(entrada.played_at);
    if (Number.isNaN(ts)) continue;

    const uri = pista.uri?.trim() ? pista.uri : null;
    const album = pista.album?.name ?? null;
    const claveTrack = trackKey(artista, pista.name);
    const { localDate, localHour } = localParts(ts, timeZone);

    filas.push({
      ts,
      // recently-played no informa de cuánto sonó realmente. La duración
      // completa es una sobreestimación acotada (Spotify solo lista lo que
      // superó ~30 s) y temporal: el dump reemplazará este rango.
      msPlayed: pista.duration_ms ?? 0,
      trackUri: uri,
      trackName: pista.name,
      artistName: artista,
      albumName: album,
      trackKey: claveTrack,
      artistKey: artistKey(artista),
      albumKey: album ? albumKey(artista, album) : null,
      localDate,
      localHour,
      reasonStart: null,
      reasonEnd: null,
      shuffle: null,
      skipped: null,
      platform: null,
      source: "live",
      dedupKey: `${ts}:${uri ?? claveTrack}`,
    });
  }

  return filas;
}
```

- [ ] **Step 4: Ejecutar el test para verificar que pasa**

Run: `npm test -- map-recently-played`
Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/capture/map-recently-played.ts tests/map-recently-played.test.ts
git commit -m "feat: conversión de recently-played a filas de streams"
```

---

## Task 11: Inserción de streams con dedup

**Files:**
- Create: `src/lib/streams.ts`
- Test: `tests/streams.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crea `tests/streams.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { NewStreamRow } from "@/db/schema";
import { streams } from "@/db/schema";
import { insertStreams } from "@/lib/streams";
import { createTestDb } from "./helpers/test-db";

function fila(over: Partial<NewStreamRow> = {}): NewStreamRow {
  const ts = over.ts ?? 1_700_000_000_000;
  return {
    ts,
    msPlayed: 210_000,
    trackUri: "spotify:track:abc",
    trackName: "Alison",
    artistName: "Slowdive",
    albumName: "Souvlaki",
    trackKey: "slowdive\u001Falison",
    artistKey: "slowdive",
    albumKey: "slowdive\u001Fsouvlaki",
    localDate: "2023-11-14",
    localHour: 15,
    reasonStart: null,
    reasonEnd: null,
    shuffle: null,
    skipped: null,
    platform: null,
    source: "live",
    dedupKey: `${ts}:spotify:track:abc`,
    ...over,
  };
}

describe("insertStreams", () => {
  it("inserta filas nuevas", async () => {
    const { db } = createTestDb();
    const insertadas = await insertStreams(db, [fila(), fila({ ts: 1_700_000_100_000, dedupKey: "otra" })]);
    expect(insertadas).toBe(2);
    expect(await db.select().from(streams)).toHaveLength(2);
  });

  it("ignora duplicados por dedup_key", async () => {
    const { db } = createTestDb();
    await insertStreams(db, [fila()]);
    const insertadas = await insertStreams(db, [fila()]);

    expect(insertadas).toBe(0);
    expect(await db.select().from(streams)).toHaveLength(1);
  });

  it("deduplica dentro del mismo lote", async () => {
    const { db } = createTestDb();
    const insertadas = await insertStreams(db, [fila(), fila()]);

    expect(insertadas).toBe(1);
    expect(await db.select().from(streams)).toHaveLength(1);
  });

  it("no falla con un lote vacío", async () => {
    const { db } = createTestDb();
    expect(await insertStreams(db, [])).toBe(0);
  });

  it("inserta lotes mayores que el tamaño de chunk", async () => {
    const { db } = createTestDb();
    const muchas = Array.from({ length: 1200 }, (_, i) =>
      fila({ ts: 1_700_000_000_000 + i * 1000, dedupKey: `clave-${i}` }),
    );

    expect(await insertStreams(db, muchas)).toBe(1200);
    expect(await db.select().from(streams)).toHaveLength(1200);
  });
});
```

- [ ] **Step 2: Ejecutar el test para verificar que falla**

Run: `npm test -- streams`
Expected: FAIL — `Failed to resolve import "@/lib/streams"`.

- [ ] **Step 3: Escribir la implementación mínima**

Crea `src/lib/streams.ts`:

```ts
import { streams, type NewStreamRow } from "@/db/schema";
import type { db as ProductionDb } from "@/db";

/**
 * Acepta la base como argumento en vez de importar el singleton, para que los
 * tests puedan pasar una base en memoria.
 */
type Db = typeof ProductionDb;

/** Por debajo del límite de variables por sentencia de SQLite. */
const CHUNK = 400;

/**
 * Inserta filas ignorando las que ya existan (mismo `dedup_key`).
 *
 * Devuelve cuántas se insertaron realmente. Deliberadamente sin `.returning()`
 * de las filas completas: en el importador esto recibirá cientos de miles de
 * filas y devolverlas sería caro para nada.
 */
export async function insertStreams(
  db: Db,
  filas: NewStreamRow[],
): Promise<number> {
  if (filas.length === 0) return 0;

  // Deduplicar dentro del lote: SQLite falla si una misma sentencia INSERT
  // contiene dos veces la misma clave única, aunque haya ON CONFLICT.
  const porClave = new Map<string, NewStreamRow>();
  for (const f of filas) porClave.set(f.dedupKey, f);
  const unicas = [...porClave.values()];

  let insertadas = 0;
  for (let i = 0; i < unicas.length; i += CHUNK) {
    const lote = unicas.slice(i, i + CHUNK);
    const resultado = await db
      .insert(streams)
      .values(lote)
      .onConflictDoNothing({ target: streams.dedupKey })
      .returning({ id: streams.id });
    insertadas += resultado.length;
  }

  return insertadas;
}
```

Nota sobre `.returning({ id })`: aquí sí se usa, pero devolviendo **una sola columna entera**, porque es la única forma de saber cuántas filas sobrevivieron al `ON CONFLICT`. Es muy distinto de devolver la fila completa, que es lo que hace hoy `saveLikedTracks`.

- [ ] **Step 4: Ejecutar el test para verificar que pasa**

Run: `npm test -- streams`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/streams.ts tests/streams.test.ts
git commit -m "feat: inserción de streams con deduplicación"
```

---

## Task 12: Orquestación de la captura

**Files:**
- Create: `src/lib/capture/run-capture.ts`

- [ ] **Step 1: Escribir la implementación**

Crea `src/lib/capture/run-capture.ts`:

```ts
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { captureState } from "@/db/schema";
import { spotifyFetchHeadless } from "@/lib/spotify-headless";
import { resolveTimeZone } from "@/lib/stats/local-time";
import { insertStreams } from "@/lib/streams";
import {
  mapRecentlyPlayed,
  type RecentlyPlayedResponse,
} from "./map-recently-played";

const FILA = 1;
const LIMITE = 50;

/** Ventana mínima entre ejecuciones automáticas, para descartar duplicadas. */
const MIN_ENTRE_EJECUCIONES_MS = 30_000;

export type CaptureResult = {
  status: "ok" | "gap" | "omitida" | "error";
  inserted: number;
  fetched: number;
  message?: string;
};

async function leerEstado() {
  const filas = await db
    .select()
    .from(captureState)
    .where(eq(captureState.id, FILA))
    .limit(1);
  return filas[0] ?? null;
}

async function guardarEstado(campos: {
  lastPlayedAt?: number | null;
  lastRunStatus: string;
  lastRunInserted?: number;
  lastError?: string | null;
  gapSuspectedAt?: number | null;
}) {
  const valores = {
    id: FILA,
    lastRunAt: Date.now(),
    lastRunStatus: campos.lastRunStatus,
    lastRunInserted: campos.lastRunInserted ?? 0,
    lastError: campos.lastError ?? null,
    ...(campos.lastPlayedAt !== undefined ? { lastPlayedAt: campos.lastPlayedAt } : {}),
    ...(campos.gapSuspectedAt !== undefined ? { gapSuspectedAt: campos.gapSuspectedAt } : {}),
  };

  await db
    .insert(captureState)
    .values(valores)
    .onConflictDoUpdate({ target: captureState.id, set: valores });
}

/**
 * Una ejecución de captura.
 *
 * @param manual Si es true, salta la protección anti-duplicados. El botón
 * "ejecutar ahora" es una acción deliberada del usuario y debe responder
 * siempre.
 */
export async function runCapture(manual = false): Promise<CaptureResult> {
  const estado = await leerEstado();

  if (
    !manual &&
    estado?.lastRunAt &&
    Date.now() - estado.lastRunAt < MIN_ENTRE_EJECUCIONES_MS
  ) {
    return {
      status: "omitida",
      inserted: 0,
      fetched: 0,
      message: "Otra ejecución acaba de correr.",
    };
  }

  try {
    const timeZone = resolveTimeZone(process.env);

    const params = new URLSearchParams({ limit: String(LIMITE) });
    if (estado?.lastPlayedAt) params.set("after", String(estado.lastPlayedAt));

    const respuesta = await spotifyFetchHeadless<RecentlyPlayedResponse>(
      `/me/player/recently-played?${params}`,
      { cache: "no-store" },
    );

    const items = respuesta.items ?? [];
    const filas = mapRecentlyPlayed(items, timeZone);
    const inserted = await insertStreams(db, filas);

    const maxTs = filas.reduce((max, f) => (f.ts > max ? f.ts : max), 0);
    const nuevoCursor = maxTs > 0 ? maxTs : (estado?.lastPlayedAt ?? null);

    // Si vinieron 50 items y TODOS eran nuevos, es probable que se hayan
    // perdido escuchas entre esta ejecución y la anterior: la ventana de la
    // API son 50 pistas y puede haberse desbordado.
    const hayHueco = items.length === LIMITE && inserted === filas.length && filas.length > 0;

    await guardarEstado({
      lastPlayedAt: nuevoCursor,
      lastRunStatus: hayHueco ? "gap" : "ok",
      lastRunInserted: inserted,
      lastError: null,
      ...(hayHueco ? { gapSuspectedAt: Date.now() } : {}),
    });

    return {
      status: hayHueco ? "gap" : "ok",
      inserted,
      fetched: items.length,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await guardarEstado({ lastRunStatus: "error", lastError: message });
    return { status: "error", inserted: 0, fetched: 0, message };
  }
}

export async function getCaptureState() {
  return leerEstado();
}
```

- [ ] **Step 2: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/lib/capture/run-capture.ts
git commit -m "feat: orquestación de una ejecución de captura"
```

---

## Task 13: Snapshot diario de los tops de la API

Los tops de `/me/top/*` son un ranking precalculado por Spotify, no escuchas: viven en `top_snapshots` y nunca entran en `streams`. Se capturan ahora, en la misma ejecución del cron, porque una serie de snapshots solo tiene valor si se empieza pronto — igual que la captura de escuchas.

**Files:**
- Create: `src/lib/capture/top-snapshots.ts`
- Modify: `src/lib/capture/run-capture.ts`

- [ ] **Step 1: Escribir el módulo de snapshots**

Crea `src/lib/capture/top-snapshots.ts`:

```ts
import "server-only";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { topSnapshots } from "@/db/schema";
import { spotifyFetchHeadless } from "@/lib/spotify-headless";

const RANGOS = ["short_term", "medium_term", "long_term"] as const;
const ENTIDADES = ["artists", "tracks"] as const;

const UN_DIA_MS = 24 * 60 * 60 * 1000;

async function ultimoSnapshot(): Promise<number | null> {
  const filas = await db
    .select({ takenAt: topSnapshots.takenAt })
    .from(topSnapshots)
    .orderBy(desc(topSnapshots.takenAt))
    .limit(1);
  return filas[0]?.takenAt ?? null;
}

/**
 * Guarda una foto de los seis tops si ha pasado más de un día desde la última.
 *
 * Se llama desde `runCapture` en lugar de tener su propia tarea programada:
 * dos crons que mantener en vez de uno no aporta nada.
 *
 * Devuelve cuántos snapshots escribió (0 si no tocaba).
 */
export async function capturarTopsSiToca(): Promise<number> {
  const ultimo = await ultimoSnapshot();
  if (ultimo && Date.now() - ultimo < UN_DIA_MS) return 0;

  const takenAt = Date.now();
  const filas: (typeof topSnapshots.$inferInsert)[] = [];

  for (const entity of ENTIDADES) {
    for (const timeRange of RANGOS) {
      const payload = await spotifyFetchHeadless<unknown>(
        `/me/top/${entity}?time_range=${timeRange}&limit=50`,
        { cache: "no-store" },
      );
      filas.push({
        takenAt,
        timeRange,
        entity,
        payloadJson: JSON.stringify(payload),
      });
    }
  }

  await db.insert(topSnapshots).values(filas);
  return filas.length;
}
```

- [ ] **Step 2: Llamarlo desde la captura**

En `src/lib/capture/run-capture.ts`, añade el import junto a los existentes:

```ts
import { capturarTopsSiToca } from "./top-snapshots";
```

Añade el campo `snapshots` al tipo `CaptureResult`:

```ts
export type CaptureResult = {
  status: "ok" | "gap" | "omitida" | "error";
  inserted: number;
  fetched: number;
  snapshots: number;
  message?: string;
};
```

Dentro de `runCapture`, justo después de la línea `const inserted = await insertStreams(db, filas);`, añade:

```ts
    // Un fallo aquí no debe tumbar la captura de escuchas, que es lo urgente.
    let snapshots = 0;
    try {
      snapshots = await capturarTopsSiToca();
    } catch (e) {
      console.warn("[captura] no se pudieron guardar los tops", e);
    }
```

Actualiza los tres `return` de la función para incluir el campo nuevo:

```ts
    return {
      status: "omitida",
      inserted: 0,
      fetched: 0,
      snapshots: 0,
      message: "Otra ejecución acaba de correr.",
    };
```

```ts
    return {
      status: hayHueco ? "gap" : "ok",
      inserted,
      fetched: items.length,
      snapshots,
    };
```

```ts
    return { status: "error", inserted: 0, fetched: 0, snapshots: 0, message };
```

- [ ] **Step 3: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/lib/capture/top-snapshots.ts src/lib/capture/run-capture.ts
git commit -m "feat: snapshot diario de los tops de la API"
```

---

## Task 14: Endpoint del cron

**Files:**
- Create: `src/app/api/cron/capture/route.ts`
- Modify: `.env.local.example`

- [ ] **Step 1: Confirmar la firma de los route handlers en este fork**

Antes de escribir el archivo, revisa lo que anotaste en la Task 0, Step 2. Si la documentación de `node_modules/next/dist/docs/` indica una firma distinta a `export async function POST(request: Request)`, **usa la de la documentación** y adapta el código de abajo.

- [ ] **Step 2: Añadir las variables de entorno**

Al final de `.env.local.example`, añade:

```
# Secreto del endpoint de captura (/api/cron/capture).
# Genera uno con: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
CRON_SECRET=

# Zona horaria IANA para local_date y local_hour — p. ej. America/Lima,
# Europe/Madrid. Obligatoria. Cambiarla obliga a recalcular desde /ajustes.
STATS_TZ=
```

Añade también los dos valores a tu `.env.local` real.

- [ ] **Step 3: Escribir el endpoint**

Crea `src/app/api/cron/capture/route.ts`:

```ts
import { timingSafeEqual } from "node:crypto";
import { runCapture } from "@/lib/capture/run-capture";

/** Siempre dinámico: nunca debe servirse una respuesta cacheada. */
export const dynamic = "force-dynamic";

/**
 * Comparación en tiempo constante. La comprobación de longitud previa filtra
 * información, pero `timingSafeEqual` exige buffers del mismo tamaño y la
 * longitud de un secreto no es el dato sensible.
 */
function secretoValido(recibido: string | null, esperado: string): boolean {
  if (!recibido) return false;
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const esperado = process.env.CRON_SECRET;

  if (!esperado) {
    return Response.json(
      { error: "CRON_SECRET no está configurado en el servidor." },
      { status: 500 },
    );
  }

  if (!secretoValido(request.headers.get("x-cron-secret"), esperado)) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const resultado = await runCapture(false);

  // El cron debe poder distinguir un fallo, así que un error va con 500 aunque
  // la ejecución en sí no haya lanzado.
  const status = resultado.status === "error" ? 500 : 200;
  return Response.json(resultado, { status });
}
```

- [ ] **Step 4: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 5: Probar el endpoint**

Con la app corriendo (`npm run dev`) y habiendo iniciado sesión al menos una vez desde el navegador:

```bash
curl -i -X POST http://127.0.0.1:3000/api/cron/capture
```

Expected: `HTTP/1.1 401` y `{"error":"No autorizado"}`.

```bash
curl -i -X POST -H "x-cron-secret: EL_SECRETO_DE_TU_ENV" http://127.0.0.1:3000/api/cron/capture
```

Expected: `HTTP/1.1 200` y un JSON como `{"status":"ok","inserted":N,"fetched":N,"snapshots":6}`.

`snapshots` será 6 la primera vez (los seis tops) y 0 en las siguientes ejecuciones del mismo día.

- [ ] **Step 6: Verificar que las filas llegaron a la base**

```bash
node -e "const D=require('better-sqlite3');const d=new D('data/ledger.db');console.log(d.prepare('SELECT COUNT(*) AS n FROM streams').get());console.log(d.prepare('SELECT ts, artist_name, track_name, local_date, local_hour FROM streams ORDER BY ts DESC LIMIT 5').all())"
```

Expected: `n` mayor que 0 y las últimas filas con tu escucha reciente. **Comprueba que `local_hour` coincide con la hora real a la que escuchaste** — si está desplazada, `STATS_TZ` está mal.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/cron/capture/route.ts .env.local.example
git commit -m "feat: endpoint /api/cron/capture protegido por secreto"
```

---

## Task 15: Panel de salud de la captura

Un cron roto que nadie mira es peor que no tener cron.

**Files:**
- Create: `src/lib/capture-actions.ts`
- Create: `src/components/CaptureHealth.tsx`
- Create: `src/app/ajustes/page.tsx`

- [ ] **Step 1: Crear la server action**

Crea `src/lib/capture-actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "./require-session";
import { runCapture, type CaptureResult } from "./capture/run-capture";

/**
 * Ejecución manual desde /ajustes.
 *
 * Toda action exportada es un endpoint HTTP público, así que exige sesión
 * (mismo patrón que el resto de actions del proyecto).
 */
export async function capturarAhora(): Promise<CaptureResult> {
  await requireSession();
  const resultado = await runCapture(true);
  revalidatePath("/ajustes");
  return resultado;
}
```

- [ ] **Step 2: Crear el componente cliente**

Crea `src/components/CaptureHealth.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { capturarAhora } from "@/lib/capture-actions";
import type { CaptureResult } from "@/lib/capture/run-capture";

export type CaptureHealthProps = {
  lastRunAt: number | null;
  lastRunStatus: string | null;
  lastRunInserted: number | null;
  lastError: string | null;
  gapSuspectedAt: number | null;
  totalStreams: number;
};

/** Umbral a partir del cual se considera que el cron dejó de correr. */
const HORAS_PARA_ALERTA = 2;

function haceCuanto(ts: number | null): string {
  if (!ts) return "nunca";
  const minutos = Math.floor((Date.now() - ts) / 60_000);
  if (minutos < 1) return "hace menos de un minuto";
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  return `hace ${Math.floor(horas / 24)} días`;
}

export default function CaptureHealth(props: CaptureHealthProps) {
  const [pendiente, startTransition] = useTransition();
  const [resultado, setResultado] = useState<CaptureResult | null>(null);

  const desatendido =
    !props.lastRunAt ||
    Date.now() - props.lastRunAt > HORAS_PARA_ALERTA * 60 * 60 * 1000;

  const ejecutar = () => {
    startTransition(async () => {
      setResultado(await capturarAhora());
    });
  };

  return (
    <section className="hairline-b px-8 py-10">
      <p className="label-mono text-mute mb-6">Captura en segundo plano</p>

      {desatendido && (
        <p className="label-mono text-blood mb-6">
          ⚠ La captura no se ejecuta desde {haceCuanto(props.lastRunAt)}. Si la
          tarea programada está activa, revisa el último error.
        </p>
      )}

      {props.gapSuspectedAt && (
        <p className="label-mono text-blood mb-6">
          ⚠ Posible hueco detectado {haceCuanto(props.gapSuspectedAt)}: llegaron
          50 escuchas nuevas de golpe, así que puede que se perdieran algunas
          entre dos ejecuciones.
        </p>
      )}

      <dl className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div>
          <dt className="label-mono text-mute">Escuchas capturadas</dt>
          <dd className="num-tabular text-2xl">
            {props.totalStreams.toLocaleString("es")}
          </dd>
        </div>
        <div>
          <dt className="label-mono text-mute">Última ejecución</dt>
          <dd className="num-tabular text-2xl">{haceCuanto(props.lastRunAt)}</dd>
        </div>
        <div>
          <dt className="label-mono text-mute">Estado</dt>
          <dd className="num-tabular text-2xl">{props.lastRunStatus ?? "—"}</dd>
        </div>
        <div>
          <dt className="label-mono text-mute">Insertadas</dt>
          <dd className="num-tabular text-2xl">{props.lastRunInserted ?? 0}</dd>
        </div>
      </dl>

      {props.lastError && (
        <p className="label-mono text-blood mb-6 break-all">
          Último error: {props.lastError}
        </p>
      )}

      <button
        type="button"
        onClick={ejecutar}
        disabled={pendiente}
        className="label-mono border border-current px-4 py-2 disabled:opacity-50"
      >
        {pendiente ? "Capturando…" : "Ejecutar ahora"}
      </button>

      {resultado && (
        <p className="label-mono text-mute mt-4">
          {resultado.status} · {resultado.fetched} leídas ·{" "}
          {resultado.inserted} nuevas
          {resultado.message ? ` · ${resultado.message}` : ""}
        </p>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Crear la página**

Crea `src/app/ajustes/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { streams } from "@/db/schema";
import { getMe } from "@/lib/spotify";
import { getCaptureState } from "@/lib/capture/run-capture";
import TopBar from "@/components/TopBar";
import CaptureHealth from "@/components/CaptureHealth";

export const dynamic = "force-dynamic";

export default async function AjustesPage() {
  const session = await auth();
  if (!session) redirect("/");

  const [me, estado, conteo] = await Promise.all([
    getMe(),
    getCaptureState(),
    db.select({ n: sql<number>`count(*)` }).from(streams),
  ]);

  return (
    <main className="min-h-screen flex flex-col">
      <TopBar me={me} active="ajustes" />

      <section className="px-8 py-16 hairline-b">
        <p className="label-mono text-acid mb-6">Ajustes</p>
        <h1 className="display-italic text-[clamp(3rem,8vw,7rem)] leading-[0.9]">
          El taller.
        </h1>
      </section>

      <CaptureHealth
        lastRunAt={estado?.lastRunAt ?? null}
        lastRunStatus={estado?.lastRunStatus ?? null}
        lastRunInserted={estado?.lastRunInserted ?? null}
        lastError={estado?.lastError ?? null}
        gapSuspectedAt={estado?.gapSuspectedAt ?? null}
        totalStreams={conteo[0]?.n ?? 0}
      />

      <section className="px-8 py-10">
        <p className="label-mono text-mute mb-4">Zona horaria</p>
        <p className="font-serif italic text-lg text-cream-dim">
          STATS_TZ ={" "}
          <span className="font-mono not-italic">
            {process.env.STATS_TZ ?? "sin configurar"}
          </span>
        </p>
      </section>

      <footer className="hairline-b mt-auto" />
      <div className="px-8 py-5 flex items-center justify-between label-mono text-mute">
        <span>TALLER</span>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Añadir "ajustes" a TopBar**

`active` es una unión cerrada de literales (`src/components/TopBar.tsx:10`), así que pasar `"ajustes"` no compila sin ampliarla.

En `src/components/TopBar.tsx`, sustituye la línea 10:

```tsx
  active?: "index" | "library" | "tags" | "smart" | "stats";
```

por:

```tsx
  active?: "index" | "library" | "tags" | "smart" | "stats" | "ajustes";
```

y añade la entrada de navegación después del `NavLink` de Stats (líneas 35-37):

```tsx
          <NavLink href="/ajustes" active={active === "ajustes"}>
            Ajustes
          </NavLink>
```

- [ ] **Step 5: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 6: Verificar en el navegador**

Run: `npm run dev`

Abre `http://127.0.0.1:3000/ajustes`.

Expected: se ve el panel con el total de escuchas y la última ejecución. Pulsa **"Ejecutar ahora"** y comprueba que el contador de escuchas sube (o que el resultado dice `0 nuevas` si no has escuchado nada desde la última captura). Comprueba también que `STATS_TZ` muestra tu zona y no "sin configurar".

- [ ] **Step 7: Commit**

```bash
git add src/lib/capture-actions.ts src/components/CaptureHealth.tsx src/app/ajustes/page.tsx src/components/TopBar.tsx
git commit -m "feat: panel de salud de la captura en /ajustes"
```

---

## Task 16: Tarea programada y documentación

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Crear la tarea programada de Windows**

En PowerShell **como administrador**, sustituyendo `EL_SECRETO` por el valor real de `CRON_SECRET`:

```powershell
schtasks /Create /TN "Voidtify captura" /SC MINUTE /MO 20 /TR "curl.exe -s -X POST -H \"x-cron-secret: EL_SECRETO\" http://127.0.0.1:3000/api/cron/capture" /F
```

Expected: `SUCCESS: The scheduled task "Voidtify captura" has successfully been created.`

- [ ] **Step 2: Probar la tarea a mano**

```powershell
schtasks /Run /TN "Voidtify captura"
```

Espera unos segundos y recarga `http://127.0.0.1:3000/ajustes`.

Expected: "Última ejecución" dice "hace menos de un minuto".

Si no cambia, comprueba que la app está corriendo: la tarea solo funciona con `npm run dev` (o `npm start`) activo. Eso es esperable en local y deja de serlo en el VPS.

- [ ] **Step 3: Documentar en el README**

Añade al `README.md`, antes de la sección "Limitaciones conocidas":

````markdown
## Captura de escuchas

La API de Spotify no guarda tu historial: solo devuelve las **últimas 50
reproducciones**. Para no perder nada hay que consultarla periódicamente.

### Variables necesarias

```
CRON_SECRET=...        # protege /api/cron/capture
STATS_TZ=Europe/Madrid # zona IANA para las estadísticas por hora y día
```

`STATS_TZ` es obligatoria y no tiene valor por defecto: una zona equivocada
produce histogramas desplazados que parecen correctos.

### En local (Windows)

Con la app corriendo, crea la tarea programada (PowerShell como administrador):

```powershell
schtasks /Create /TN "Voidtify captura" /SC MINUTE /MO 20 /TR "curl.exe -s -X POST -H \"x-cron-secret: EL_SECRETO\" http://127.0.0.1:3000/api/cron/capture" /F
```

### En un VPS

```bash
*/20 * * * * curl -sX POST -H "x-cron-secret: EL_SECRETO" http://127.0.0.1:3000/api/cron/capture
```

Misma ruta y mismo código en ambos entornos.

### Estado

`/ajustes` muestra la última ejecución, cuántas escuchas van capturadas y el
último error. Avisa si la captura lleva más de dos horas sin correr o si
detecta un posible hueco.

### Por qué cada 20 minutos

La ventana de la API son 50 pistas, unas 2,5–3 h de escucha continua. Veinte
minutos deja margen de sobra incluso si el equipo estuvo suspendido, y son solo
~72 llamadas al día.
````

- [ ] **Step 4: Verificar que la captura persiste sola**

Deja la app corriendo, escucha música durante media hora y vuelve a `/ajustes`.

Expected: el total de escuchas capturadas ha subido sin que hayas pulsado nada.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: documentar la captura de escuchas y su tarea programada"
```

---

## Task 17: Rehacer los rangos sobre días locales

Sustituye por completo a la Task 4. Implementa la decisión **D9** del documento de diseño.

Tres defectos que arregla, todos confirmados ejecutando código en la revisión:

1. **Cadena de prototipos.** `preset in PRESETS` deja pasar `"constructor"`, `"toString"`, `"__proto__"`. `PRESETS["constructor"]` resuelve a `Object`, se desestructura a `{label: undefined, days: undefined}` y produce `from: NaN`. Ese `NaN` se enlaza como `NULL` en SQLite, así que `BETWEEN NULL AND x` no coincide con nada: página vacía, sin error, contradiciendo la promesa del propio módulo de caer siempre al preset por defecto.
2. **Límites en UTC contra datos en hora local.** `desde=2019-03-01` producía `2019-03-01T00:00:00Z` = 28 de febrero a las 19:00 en `America/Guayaquil`. Un rango de un día cubría cinco horas del día anterior y perdía las cinco últimas del día pedido.
3. **Desbordamiento de calendario.** `Date.UTC(2019, 1, 30)` no da `NaN`: desborda al 2 de marzo. `?desde=2019-02-30` devolvía una etiqueta que decía "2019-02-30" y un rango que empezaba el 2 de marzo.

**Files:**
- Modify: `src/lib/stats/range.ts` (reescritura completa)
- Modify: `tests/range.test.ts` (reescritura completa)

- [ ] **Step 1: Reescribir el test**

Sustituye por completo el contenido de `tests/range.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseRange, PRESETS } from "@/lib/stats/range";

// 2026-07-27T12:00:00Z. En America/Guayaquil (UTC-5) son las 07:00 del día 27.
const AHORA = Date.UTC(2026, 6, 27, 12, 0, 0);
const TZ = "America/Guayaquil";

describe("presets", () => {
  it("por defecto devuelve las últimas 4 semanas en días locales", () => {
    const r = parseRange({}, AHORA, TZ);
    expect(r.toDate).toBe("2026-07-27");
    // 30 jun → 27 jul son 28 días contando ambos extremos.
    expect(r.fromDate).toBe("2026-06-30");
    expect(r.preset).toBe("4w");
    expect(r.label).toBe(PRESETS["4w"].label);
  });

  it("resuelve el preset de 6 meses", () => {
    const r = parseRange({ preset: "6m" }, AHORA, TZ);
    expect(r.toDate).toBe("2026-07-27");
    // 27 ene → 27 jul son 182 días contando ambos extremos.
    expect(r.fromDate).toBe("2026-01-27");
    expect(r.preset).toBe("6m");
  });

  it("resuelve el preset de un año", () => {
    const r = parseRange({ preset: "year" }, AHORA, TZ);
    expect(r.toDate).toBe("2026-07-27");
    // 28 jul 2025 → 27 jul 2026 son 365 días contando ambos extremos.
    expect(r.fromDate).toBe("2025-07-28");
    expect(r.preset).toBe("year");
  });

  it("cada preset cubre exactamente los días que promete su nombre", () => {
    // Ancla la aritmética de extremos inclusivos: si alguien cambia `days`
    // sin pensar, esto se rompe antes de que las cifras salgan mal en la UI.
    const dias = (r: { fromDate: string; toDate: string }) =>
      Math.round(
        (Date.parse(`${r.toDate}T12:00:00Z`) -
          Date.parse(`${r.fromDate}T12:00:00Z`)) /
          86_400_000,
      ) + 1;

    expect(dias(parseRange({ preset: "4w" }, AHORA, TZ))).toBe(28);
    expect(dias(parseRange({ preset: "6m" }, AHORA, TZ))).toBe(182);
    expect(dias(parseRange({ preset: "year" }, AHORA, TZ))).toBe(365);
  });

  it("el preset histórico empieza en 1970", () => {
    const r = parseRange({ preset: "all" }, AHORA, TZ);
    expect(r.fromDate).toBe("1970-01-01");
    expect(r.toDate).toBe("2026-07-27");
  });

  it("usa el día local, no el día UTC", () => {
    // 2026-07-27T02:00:00Z son las 21:00 del día 26 en Guayaquil.
    const madrugada = Date.UTC(2026, 6, 27, 2, 0, 0);
    expect(parseRange({}, madrugada, TZ).toDate).toBe("2026-07-26");
    expect(parseRange({}, madrugada, "UTC").toDate).toBe("2026-07-27");
  });
});

describe("rangos personalizados", () => {
  it("acepta un rango explícito y lo devuelve tal cual", () => {
    const r = parseRange({ desde: "2019-03-01", hasta: "2019-07-31" }, AHORA, TZ);
    expect(r.fromDate).toBe("2019-03-01");
    expect(r.toDate).toBe("2019-07-31");
    expect(r.preset).toBe("custom");
  });

  it("tiene prioridad sobre el preset", () => {
    const r = parseRange(
      { preset: "6m", desde: "2019-03-01", hasta: "2019-03-31" },
      AHORA,
      TZ,
    );
    expect(r.preset).toBe("custom");
  });

  it("intercambia las fechas si vienen al revés", () => {
    const r = parseRange({ desde: "2019-07-31", hasta: "2019-03-01" }, AHORA, TZ);
    expect(r.fromDate).toBe("2019-03-01");
    expect(r.toDate).toBe("2019-07-31");
  });

  it("la etiqueta refleja el rango real, no la entrada cruda", () => {
    const r = parseRange({ desde: "2019-07-31", hasta: "2019-03-01" }, AHORA, TZ);
    expect(r.label).toBe("2019-03-01 → 2019-07-31");
  });

  it("admite un rango de un solo día", () => {
    const r = parseRange({ desde: "2019-03-01", hasta: "2019-03-01" }, AHORA, TZ);
    expect(r.fromDate).toBe("2019-03-01");
    expect(r.toDate).toBe("2019-03-01");
  });
});

describe("entradas inválidas", () => {
  it("cae al preset por defecto si las fechas no tienen el formato", () => {
    expect(parseRange({ desde: "no-es-fecha", hasta: "tampoco" }, AHORA, TZ).preset)
      .toBe("4w");
  });

  it("rechaza una fecha que no existe en el calendario", () => {
    // Date.UTC(2019, 1, 30) desborda silenciosamente al 2 de marzo.
    expect(parseRange({ desde: "2019-02-30", hasta: "2019-03-31" }, AHORA, TZ).preset)
      .toBe("4w");
    expect(parseRange({ desde: "2019-13-01", hasta: "2019-12-31" }, AHORA, TZ).preset)
      .toBe("4w");
    expect(parseRange({ desde: "2019-04-31", hasta: "2019-05-31" }, AHORA, TZ).preset)
      .toBe("4w");
  });

  it("acepta el 29 de febrero en año bisiesto", () => {
    const r = parseRange({ desde: "2020-02-29", hasta: "2020-03-01" }, AHORA, TZ);
    expect(r.preset).toBe("custom");
    expect(r.fromDate).toBe("2020-02-29");
  });

  it("rechaza el 29 de febrero en año no bisiesto", () => {
    expect(parseRange({ desde: "2019-02-29", hasta: "2019-03-01" }, AHORA, TZ).preset)
      .toBe("4w");
  });

  it("ignora un rango con solo una de las dos fechas", () => {
    expect(parseRange({ desde: "2019-03-01" }, AHORA, TZ).preset).toBe("4w");
    expect(parseRange({ hasta: "2019-03-01" }, AHORA, TZ).preset).toBe("4w");
  });

  it("cae al preset por defecto si el preset no existe", () => {
    expect(parseRange({ preset: "inventado" }, AHORA, TZ).preset).toBe("4w");
  });

  it("no deja pasar claves heredadas del prototipo", () => {
    // `preset in PRESETS` las dejaba pasar y producía from: NaN, label: undefined.
    for (const clave of ["constructor", "toString", "hasOwnProperty", "valueOf"]) {
      const r = parseRange({ preset: clave }, AHORA, TZ);
      expect(r.preset).toBe("4w");
      expect(r.label).toBe(PRESETS["4w"].label);
      expect(r.fromDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
```

- [ ] **Step 2: Ejecutar el test para verificar que falla**

Run: `npm test -- range`
Expected: FAIL. Los tests nuevos esperan `fromDate`/`toDate` y un tercer parámetro; la implementación actual devuelve `from`/`to` numéricos.

- [ ] **Step 3: Reescribir la implementación**

Sustituye por completo el contenido de `src/lib/stats/range.ts`:

```ts
/**
 * Resolución de rangos temporales.
 *
 * Todas las consultas de estadísticas reciben un `StatsRange`. Los presets y el
 * rango libre producen la misma estructura, así que "mis top artistas entre
 * marzo y julio de 2019" no es un caso especial: es el caso general con otras
 * fechas.
 *
 * Los límites son **fechas locales inclusivas** ('YYYY-MM-DD' en STATS_TZ), no
 * marcas de tiempo epoch, y las consultas filtran por la columna `local_date`.
 * Filtrar por `ts` en UTC desplazaba cada extremo cinco horas respecto al día
 * local del usuario, y hacía que un preset y un rango manual equivalente
 * devolvieran cifras distintas. Ver D9 en el documento de diseño.
 *
 * Módulo puro: sin `server-only`, sin base de datos.
 */
import { localParts } from "./local-time";

export type PresetId = "4w" | "6m" | "year" | "all";

export type StatsRange = {
  /** 'YYYY-MM-DD' en STATS_TZ, inclusiva. */
  fromDate: string;
  /** 'YYYY-MM-DD' en STATS_TZ, inclusiva. */
  toDate: string;
  label: string;
  preset: PresetId | "custom";
};

const DIA_MS = 24 * 60 * 60 * 1000;

/** Cota inferior del preset histórico. Anterior a cualquier escucha posible. */
const INICIO_DE_LOS_TIEMPOS = "1970-01-01";

export const PRESETS: Record<PresetId, { label: string; days: number | null }> = {
  "4w": { label: "Últimas 4 semanas", days: 27 },
  "6m": { label: "Últimos 6 meses", days: 181 },
  year: { label: "Último año", days: 364 },
  all: { label: "Histórico", days: null },
};

const PRESET_POR_DEFECTO: PresetId = "4w";

export type RangeParams = {
  preset?: string;
  desde?: string;
  hasta?: string;
};

/**
 * Valida 'YYYY-MM-DD', incluyendo que la fecha exista en el calendario.
 *
 * La comprobación de ida y vuelta es imprescindible: `Date.UTC(2019, 1, 30)` no
 * devuelve `NaN`, desborda silenciosamente al 2 de marzo. Sin ella, un rango
 * mostraría una etiqueta que no corresponde con los datos consultados.
 */
function diaValido(valor: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor.trim());
  if (!m) return null;

  const [, y, mes, d] = m;
  const v = new Date(Date.UTC(Number(y), Number(mes) - 1, Number(d)));

  if (
    v.getUTCFullYear() !== Number(y) ||
    v.getUTCMonth() !== Number(mes) - 1 ||
    v.getUTCDate() !== Number(d)
  ) {
    return null;
  }

  return `${y}-${mes}-${d}`;
}

function desdePreset(
  preset: PresetId,
  ahora: number,
  timeZone: string,
): StatsRange {
  const { label, days } = PRESETS[preset];
  const toDate = localParts(ahora, timeZone).localDate;

  return {
    fromDate:
      days === null
        ? INICIO_DE_LOS_TIEMPOS
        : localParts(ahora - days * DIA_MS, timeZone).localDate,
    toDate,
    label,
    preset,
  };
}

/**
 * Un rango explícito (ambas fechas válidas) tiene prioridad sobre el preset.
 * Cualquier entrada inválida cae al preset por defecto en vez de lanzar: estos
 * valores vienen de la URL y el usuario puede escribir cualquier cosa.
 */
export function parseRange(
  params: RangeParams,
  ahora: number,
  timeZone: string,
): StatsRange {
  if (params.desde && params.hasta) {
    const a = diaValido(params.desde);
    const b = diaValido(params.hasta);

    if (a !== null && b !== null) {
      const fromDate = a <= b ? a : b;
      const toDate = a <= b ? b : a;
      return {
        fromDate,
        toDate,
        // La etiqueta refleja el rango ya normalizado, no la entrada cruda:
        // mostrar lo que el usuario tecleó cuando difiere de lo consultado es
        // precisamente el fallo que esta reescritura elimina.
        label: `${fromDate} → ${toDate}`,
        preset: "custom",
      };
    }
  }

  const preset = params.preset;
  // `hasOwnProperty` y no `in`: `in` recorre la cadena de prototipos, así que
  // `?preset=constructor` pasaba el filtro y `PRESETS[preset]` resolvía a
  // `Object`, produciendo un rango con `label: undefined`.
  if (preset && Object.prototype.hasOwnProperty.call(PRESETS, preset)) {
    return desdePreset(preset as PresetId, ahora, timeZone);
  }

  return desdePreset(PRESET_POR_DEFECTO, ahora, timeZone);
}
```

Nota sobre los días de cada preset: bajan de 28/182/365 a 27/181/364 porque ahora ambos extremos son **inclusivos**. "Últimas 4 semanas" debe cubrir 28 días contando hoy, así que retrocede 27.

- [ ] **Step 4: Ejecutar el test para verificar que pasa**

Run: `npm test -- range`
Expected: PASS, 18 tests.

- [ ] **Step 5: Verificar tipos, lint y suite completa**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: sin errores; ningún otro test roto.

- [ ] **Step 6: Commit**

```bash
git add src/lib/stats/range.ts tests/range.test.ts
git commit -m "fix: rangos alineados al día local en vez de a epochs UTC"
```

---

## Task 18: Endurecer el esquema

Surge de la revisión de calidad de la Task 6. Se hace **ahora, con la tabla vacía**, porque el primer punto cambia una restricción de columna y hacerlo con 300 000 filas dentro obliga a reconstruir la tabla.

**Files:**
- Modify: `src/db/schema-sql.ts`
- Modify: `src/db/schema.ts`
- Modify: `tests/schema.test.ts`
- Create: `tests/schema-parity.test.ts`

- [ ] **Step 1: Test que exige el CHECK sobre `source`**

Añade a `tests/schema.test.ts`, dentro del `describe("esquema")`:

```ts
  it("rechaza un valor de source fuera de 'live' e 'import'", () => {
    const { sqlite } = createTestDb();
    const insertar = sqlite.prepare(`
      INSERT INTO streams
        (ts, ms_played, track_name, artist_name, track_key, artist_key,
         local_date, local_hour, source, dedup_key)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const fila = (source: string, dedup: string) => [
      1_700_000_000_000, 210_000, "Alison", "Slowdive",
      "slowdivealison", "slowdive", "2023-11-14", 15, source, dedup,
    ];

    // Los dos valores legítimos entran.
    expect(() => insertar.run(...fila("live", "a"))).not.toThrow();
    expect(() => insertar.run(...fila("import", "b"))).not.toThrow();

    // El borrado de la regla "el dump manda" busca source = 'live' exacto.
    // Una variante de mayúsculas o con espacios rompería la deduplicación en
    // silencio, así que la base tiene que rechazarla.
    expect(() => insertar.run(...fila("Live", "c"))).toThrow(/CHECK/);
    expect(() => insertar.run(...fila("live ", "d"))).toThrow(/CHECK/);
    expect(() => insertar.run(...fila("", "e"))).toThrow(/CHECK/);
  });
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- schema`
Expected: FAIL — las tres inserciones inválidas no lanzan, porque no existe el `CHECK`.

- [ ] **Step 3: Añadir el CHECK**

En `src/db/schema-sql.ts`, dentro de `CREATE TABLE IF NOT EXISTS streams`, sustituye:

```sql
    source        TEXT NOT NULL,
```

por:

```sql
    source        TEXT NOT NULL CHECK (source IN ('live', 'import')),
```

**Aviso sobre bases existentes:** `CREATE TABLE IF NOT EXISTS` no modifica una tabla que ya exista. Si ya arrancaste la app y `data/ledger.db` tiene la tabla `streams` sin el `CHECK`, seguirá sin él. Como todavía no hay ninguna fila, la forma limpia de aplicarlo es borrar solo esa tabla y dejar que se recree al siguiente arranque:

```bash
node -e "const D=require('better-sqlite3');const d=new D('data/ledger.db');const n=d.prepare('SELECT COUNT(*) AS n FROM streams').get().n;if(n>0){console.error('ABORTADO: la tabla tiene '+n+' filas');process.exit(1)}d.exec('DROP TABLE streams');console.log('streams eliminada; se recreará con el CHECK al arrancar')"
```

El guardia de `COUNT(*)` es deliberado: si alguna vez se ejecuta cuando ya hay escuchas capturadas, aborta en vez de destruirlas.

- [ ] **Step 4: Reflejar el CHECK en Drizzle**

En `src/db/schema.ts`, la columna `source` de `streams` pasa a documentar la restricción. Drizzle no genera el `CHECK` (el DDL es la fuente de verdad aquí), así que basta el comentario:

```ts
    /** 'live' | 'import'. Restringido por CHECK en el DDL: el borrado de D2
     *  depende de que el valor sea exactamente 'live'. */
    source: text("source").notNull(),
```

- [ ] **Step 5: Ejecutar y verificar que pasa**

Run: `npm test -- schema`
Expected: PASS.

- [ ] **Step 6: Test de paridad entre el DDL y Drizzle**

Crea `tests/schema-parity.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import * as schema from "@/db/schema";
import { createTestDb } from "./helpers/test-db";

type ColumnaSqlite = {
  name: string;
  notnull: number;
  pk: number;
};

/**
 * El esquema está descrito dos veces: como DDL en `schema-sql.ts` (lo que
 * ejecuta SQLite) y como definiciones de Drizzle en `schema.ts` (lo que ve
 * TypeScript). Nada obliga a que coincidan, y una columna añadida en un solo
 * lado compila, pasa los demás tests y falla al insertar.
 */
describe("paridad entre el DDL y las definiciones de Drizzle", () => {
  // Filtro simple + cast, y no un predicado de tipo: `(v): v is ...` no
  // type-checkea contra el tipo unión de `Object.values(schema)` y dispara
  // TS2677. El comportamiento en tiempo de ejecución es el mismo.
  const tablas = Object.values(schema).filter(
    (v) => typeof v === "object" && v !== null && getTableConfigSeguro(v) !== null,
  ) as Parameters<typeof getTableConfig>[0][];

  it("encuentra tablas que comparar", () => {
    expect(tablas.length).toBeGreaterThanOrEqual(11);
  });

  it("cada tabla de Drizzle tiene las mismas columnas que el DDL", () => {
    const { sqlite } = createTestDb();
    const problemas: string[] = [];

    for (const tabla of tablas) {
      const config = getTableConfig(tabla);
      const enSqlite = sqlite
        .prepare(`PRAGMA table_info(${config.name})`)
        .all() as ColumnaSqlite[];

      if (enSqlite.length === 0) {
        problemas.push(`${config.name}: no existe en el DDL`);
        continue;
      }

      const nombresSqlite = new Set(enSqlite.map((c) => c.name));
      const nombresDrizzle = new Set(config.columns.map((c) => c.name));

      for (const n of nombresDrizzle) {
        if (!nombresSqlite.has(n)) {
          problemas.push(`${config.name}.${n}: en Drizzle pero no en el DDL`);
        }
      }
      for (const n of nombresSqlite) {
        if (!nombresDrizzle.has(n)) {
          problemas.push(`${config.name}.${n}: en el DDL pero no en Drizzle`);
        }
      }

      // La nulabilidad también tiene que coincidir: una columna NOT NULL en SQL
      // y opcional en Drizzle deja pasar inserciones que la base rechazará.
      for (const col of config.columns) {
        const sqliteCol = enSqlite.find((c) => c.name === col.name);
        if (!sqliteCol) continue;
        // Una PRIMARY KEY INTEGER es implícitamente NOT NULL en SQLite aunque
        // `notnull` valga 0, así que se excluye de la comparación.
        if (sqliteCol.pk === 1) continue;
        const sqlNotNull = sqliteCol.notnull === 1;
        if (sqlNotNull !== col.notNull) {
          problemas.push(
            `${config.name}.${col.name}: NOT NULL difiere ` +
              `(DDL=${sqlNotNull}, Drizzle=${col.notNull})`,
          );
        }
      }
    }

    expect(problemas).toEqual([]);
  });
});

/** `getTableConfig` lanza si el valor no es una tabla; esto lo convierte en null. */
function getTableConfigSeguro(v: unknown) {
  try {
    return getTableConfig(v as Parameters<typeof getTableConfig>[0]);
  } catch {
    return null;
  }
}
```

- [ ] **Step 7: Ejecutar el test de paridad**

Run: `npm test -- schema-parity`
Expected: PASS. Si falla, **no ajustes el test**: el fallo significa que el DDL y Drizzle han divergido de verdad, y lo que hay que arreglar es la divergencia.

Para comprobar que el test detecta lo que dice detectar, añade temporalmente una columna en `schema.ts` que no exista en el DDL, ejecuta el test, confirma que falla señalando esa columna, y deshaz el cambio.

- [ ] **Step 8: Tipar shuffle y skipped como booleanos**

En `src/db/schema.ts`, sustituye:

```ts
    shuffle: integer("shuffle"),
    skipped: integer("skipped"),
```

por:

```ts
    /** NULL en filas `live`: recently-played no informa de esto. */
    shuffle: integer("shuffle", { mode: "boolean" }),
    /** NULL en filas `live`. Las estadísticas de skips solo usan `import`. */
    skipped: integer("skipped", { mode: "boolean" }),
```

Drizzle sigue almacenando 0/1/NULL, así que el DDL no cambia; lo que cambia es que TypeScript los ve como `boolean | null` en vez de `number | null`, y desaparece la clase de errores `=== 1` contra `=== true` en el código de estadísticas que aún no existe.

Añade también el comentario que falta en los dos campos hermanos:

```ts
    /** NULL en filas `live`. */
    reasonStart: text("reason_start"),
    /** NULL en filas `live`. */
    reasonEnd: text("reason_end"),
```

- [ ] **Step 9: Verificar todo**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: sin errores, toda la suite en verde.

- [ ] **Step 10: Commit**

```bash
git add src/db/schema-sql.ts src/db/schema.ts tests/schema.test.ts tests/schema-parity.test.ts
git commit -m "feat: CHECK en source, test de paridad DDL/Drizzle y booleanos tipados"
```

---

## Task 19: Quitar el horario de verano de la aritmética de presets

Surge de la revisión de calidad de la Task 17, que reprodujo el fallo.

`desdePreset` hace `localParts(ahora - days * DIA_MS, timeZone)`: resta milisegundos fijos y **después** convierte a fecha local. Si esa resta cruza un cambio de hora, el resultado cae un día antes o después del que corresponde. Con `ahora = 2026-01-01T22:00:00Z` y el preset `6m` en `Europe/Madrid`, da `2025-07-05` cuando la resta de días de calendario da `2025-07-04`.

Hoy es inofensivo porque `STATS_TZ=America/Guayaquil` y Ecuador no observa horario de verano. Deja de serlo en cuanto alguien cambie la zona — y el mensaje de error de `resolveTimeZone` sugiere literalmente `Europe/Madrid` como ejemplo, invitando al fallo que el código no soporta.

**El arreglo elimina la zona horaria de la resta.** Se convierte a fecha local primero, y se restan días sobre la fecha de calendario, donde el horario de verano no existe.

**Files:**
- Modify: `src/lib/stats/range.ts`
- Modify: `src/lib/stats/local-time.ts` (solo el ejemplo del mensaje de error)
- Modify: `tests/range.test.ts`

- [ ] **Step 1: Test que expone el fallo**

Añade a `tests/range.test.ts` un bloque nuevo:

```ts
describe("zonas con horario de verano", () => {
  // El preset debe caer en el mismo día de calendario que se obtiene restando
  // días sobre la fecha local, no restando milisegundos sobre el instante.
  function restaDeCalendario(localDate: string, days: number): string {
    const [y, m, d] = localDate.split("-").map(Number);
    const v = new Date(Date.UTC(y, m - 1, d) - days * 86_400_000);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${v.getUTCFullYear()}-${p(v.getUTCMonth() + 1)}-${p(v.getUTCDate())}`;
  }

  it("no se desplaza al cruzar un cambio de hora en Madrid", () => {
    // 2026-01-01T22:00:00Z son las 23:00 del 1 de enero en Madrid (CET, +1).
    // Restar 181 días en milisegundos cruza el cambio a CEST y cae un día tarde.
    const ahora = Date.UTC(2026, 0, 1, 22, 0, 0);
    const r = parseRange({ preset: "6m" }, ahora, "Europe/Madrid");

    expect(r.toDate).toBe("2026-01-01");
    expect(r.fromDate).toBe(restaDeCalendario("2026-01-01", 181));
    expect(r.fromDate).toBe("2025-07-04");
  });

  it("no se desplaza en Santiago, que cambia la hora en sentido opuesto", () => {
    const ahora = Date.UTC(2026, 6, 1, 3, 0, 0);
    const r = parseRange({ preset: "6m" }, ahora, "America/Santiago");
    expect(r.fromDate).toBe(restaDeCalendario(r.toDate, 181));
  });

  it("los presets cubren los días prometidos en cualquier zona", () => {
    const dias = (r: { fromDate: string; toDate: string }) =>
      Math.round(
        (Date.parse(`${r.toDate}T12:00:00Z`) -
          Date.parse(`${r.fromDate}T12:00:00Z`)) /
          86_400_000,
      ) + 1;

    for (const tz of ["Europe/Madrid", "America/Santiago", "Pacific/Auckland"]) {
      // Se recorre un año entero de instantes para atrapar cualquier cruce.
      for (let dia = 0; dia < 365; dia += 7) {
        const ahora = Date.UTC(2026, 0, 1, 22, 0, 0) + dia * 86_400_000;
        expect(dias(parseRange({ preset: "4w" }, ahora, tz))).toBe(28);
        expect(dias(parseRange({ preset: "6m" }, ahora, tz))).toBe(182);
        expect(dias(parseRange({ preset: "year" }, ahora, tz))).toBe(365);
      }
    }
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- range`
Expected: FAIL en los tests de Madrid y de cobertura de días, con `fromDate` desplazado un día.

- [ ] **Step 3: Restar sobre la fecha de calendario**

En `src/lib/stats/range.ts`, añade este helper junto a `diaValido`:

```ts
/**
 * Resta días a una fecha 'YYYY-MM-DD' devolviendo otra fecha 'YYYY-MM-DD'.
 *
 * Opera sobre la fecha de calendario, no sobre un instante, así que el horario
 * de verano no interviene: un día de calendario siempre son 24 h en esta
 * aritmética porque no hay zona horaria de por medio. Restar milisegundos al
 * instante y convertir después desplaza el resultado un día cuando la resta
 * cruza un cambio de hora.
 */
function restarDias(fecha: string, dias: number): string {
  const [y, m, d] = fecha.split("-").map(Number);
  const v = new Date(Date.UTC(y, m - 1, d) - dias * DIA_MS);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${v.getUTCFullYear()}-${p(v.getUTCMonth() + 1)}-${p(v.getUTCDate())}`;
}
```

Y sustituye el cuerpo de `desdePreset` por:

```ts
function desdePreset(
  preset: PresetId,
  ahora: number,
  timeZone: string,
): StatsRange {
  const { label, days } = PRESETS[preset];
  // Primero se pasa a día local, y solo después se restan días de calendario.
  const toDate = localParts(ahora, timeZone).localDate;

  return {
    fromDate: days === null ? INICIO_DE_LOS_TIEMPOS : restarDias(toDate, days),
    toDate,
    label,
    preset,
  };
}
```

- [ ] **Step 4: Arreglar el ejemplo que invita al fallo**

En `src/lib/stats/local-time.ts`, el mensaje de error de `resolveTimeZone` propone `Europe/Madrid`. Ya no es un ejemplo peligroso una vez arreglada la aritmética, pero conviene que sugiera la zona real del proyecto. Sustituye:

```ts
        "p. ej. STATS_TZ=Europe/Madrid",
```

por:

```ts
        "p. ej. STATS_TZ=America/Guayaquil",
```

- [ ] **Step 5: Ejecutar y verificar que pasa**

Run: `npm test -- range`
Expected: PASS.

- [ ] **Step 6: Verificar todo**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: sin errores, toda la suite en verde.

- [ ] **Step 7: Commit**

```bash
git add src/lib/stats/range.ts src/lib/stats/local-time.ts tests/range.test.ts
git commit -m "fix: restar días de calendario en los presets, no milisegundos"
```

---

## Task 21: Error tipado y `attempt` privado en el núcleo HTTP

Surge de la revisión de calidad de la Task 7. Se hace **antes** de la Task 14, porque el endpoint del cron tiene que ramificar según el tipo de error y retrofitear eso después cuesta más.

**Files:**
- Create: `tests/stubs/server-only.ts`
- Modify: `vitest.config.ts`
- Modify: `src/lib/spotify-core.ts`
- Test: `tests/spotify-core.test.ts` (nuevo)

- [ ] **Step 0: Permitir testear módulos con `server-only`**

Este es el primer test que importa un módulo de servidor, y falla antes de ejecutar nada:

```
Error: Cannot find package 'server-only' imported from src/lib/spotify-core.ts
```

`server-only` no es una dependencia instalada: solo existe dentro del bundle compilado de Next, que tiene un atajo de resolución propio. Vitest corre en Node puro y no lo encuentra.

**No se instala el paquete de npm.** El `server-only` real lanza una excepción al importarse fuera de un contexto de servidor, así que instalarlo cambiaría el fallo de "no encontrado" a "excepción al cargar". Se resuelve con un alias a un módulo vacío: la directiva es una salvaguarda **del bundler** —impedir que el módulo acabe en un bundle de cliente— y esa preocupación no existe en un test de Node.

Crea `tests/stubs/server-only.ts`:

```ts
// Stub vacío para los tests.
//
// `server-only` no es un paquete instalado: solo existe dentro del bundler de
// Next. Es un centinela de build que impide que un módulo de servidor acabe en
// un bundle de cliente — una garantía del empaquetado, no del runtime. En Node
// no hay bundle de cliente que proteger, así que resolverlo a nada es correcto
// y no debilita ninguna comprobación real.
export {};
```

Y en `vitest.config.ts`, dentro de `resolve.alias`, añade la entrada junto a la de `@`:

```ts
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
```

- [ ] **Step 1: Escribir el test**

Crea `tests/spotify-core.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { SpotifyApiError } from "@/lib/spotify-core";

describe("SpotifyApiError", () => {
  it("conserva status y retryAfterSec", () => {
    const e = new SpotifyApiError("límite alcanzado", 429, 120);
    expect(e.status).toBe(429);
    expect(e.retryAfterSec).toBe(120);
  });

  it("permite omitir retryAfterSec", () => {
    const e = new SpotifyApiError("no encontrado", 404);
    expect(e.status).toBe(404);
    expect(e.retryAfterSec).toBeUndefined();
  });

  it("es reconocible con instanceof y sigue siendo un Error", () => {
    const e: unknown = new SpotifyApiError("x", 500);
    expect(e).toBeInstanceOf(SpotifyApiError);
    expect(e).toBeInstanceOf(Error);
  });

  it("expone el nombre para que aparezca en los logs", () => {
    expect(new SpotifyApiError("x", 500).name).toBe("SpotifyApiError");
  });

  it("conserva el mensaje", () => {
    expect(new SpotifyApiError("mensaje concreto", 500).message).toBe(
      "mensaje concreto",
    );
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- spotify-core`
Expected: FAIL — `SpotifyApiError` no está exportado.

- [ ] **Step 3: Añadir la clase de error**

En `src/lib/spotify-core.ts`, justo después del `import` y la constante `SPOTIFY_API`, añade:

```ts
/**
 * Error de la Web API con el status HTTP accesible.
 *
 * Existe como clase y no como objeto con propiedades añadidas por cast porque
 * hay dos consumidores con necesidades distintas: una página que solo muestra
 * el mensaje, y el cron de captura, que debe decidir si registra el fallo o lo
 * reintenta más tarde. Ramificar con `instanceof` es fiable; comprobar la
 * forma de un objeto casteado, no.
 */
export class SpotifyApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfterSec?: number,
  ) {
    super(message);
    this.name = "SpotifyApiError";
  }
}
```

- [ ] **Step 4: Usarla en los dos puntos donde se lanza**

Sustituye el bloque del límite de espera:

```ts
    if (retryAfterSec > MAX_AUTO_WAIT_S) {
      const minutes = Math.ceil(retryAfterSec / 60);
      const err = new Error(
        `Spotify rate limit: ${minutes} min de espera. Intenta más tarde.`,
      ) as Error & { status?: number; retryAfterSec?: number };
      err.status = 429;
      err.retryAfterSec = retryAfterSec;
      throw err;
    }
```

por:

```ts
    if (retryAfterSec > MAX_AUTO_WAIT_S) {
      const minutes = Math.ceil(retryAfterSec / 60);
      throw new SpotifyApiError(
        `Spotify rate limit: ${minutes} min de espera. Intenta más tarde.`,
        429,
        retryAfterSec,
      );
    }
```

Y el bloque de respuesta no correcta:

```ts
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`Spotify ${res.status}: ${text}`) as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }
```

por:

```ts
  if (!res.ok) {
    const text = await res.text();
    throw new SpotifyApiError(`Spotify ${res.status}: ${text}`, res.status);
  }
```

- [ ] **Step 5: Hacer privado el parámetro `attempt`**

`attempt` es un detalle de la recursión y no debe formar parte de la firma pública. Renombra la función actual a `doRequest`, quítale el `export`, y añade encima el punto de entrada exportado:

```ts
/**
 * Petición a la Web API con rate limiting y reintentos.
 *
 * Recibe el access token como argumento en vez de leerlo de la sesión, de modo
 * que sirve tanto a las peticiones con sesión (`spotifyFetch`) como a las del
 * cron sin cookie (`spotifyFetchHeadless`). Sin esta separación, la lógica de
 * reintentos habría que duplicarla.
 */
export function spotifyRequest<T>(
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  return doRequest<T>(accessToken, path, init, 0);
}

async function doRequest<T>(
  accessToken: string,
  path: string,
  init: RequestInit,
  attempt: number,
): Promise<T> {
```

La llamada recursiva del final pasa a ser `doRequest<T>(accessToken, path, init, attempt + 1)`.

**No cambies nada más del cuerpo:** ni el orden del rate limiter, ni el conjunto de métodos idempotentes, ni el tope de 4 intentos, ni la fórmula del backoff.

- [ ] **Step 6: Ejecutar y verificar que pasa**

Run: `npm test -- spotify-core`
Expected: PASS, 5 tests.

- [ ] **Step 7: Verificar que nada más se rompió**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: sin errores; toda la suite en verde.

Comprueba también que ningún consumidor pasaba un cuarto argumento:

```bash
grep -rn "spotifyRequest(" src/ | grep -v "spotify-core.ts"
```

Expected: solo llamadas de tres argumentos.

- [ ] **Step 8: Commit**

```bash
git add src/lib/spotify-core.ts tests/spotify-core.test.ts
git commit -m "refactor: error tipado y attempt privado en el núcleo HTTP"
```

---

## Task 22: No marcar hueco en la primera ejecución

Detectado al probar la Task 14 contra la cuenta real: la primera ejecución devolvió `status: "gap"`.

Según la heurística es correcto —llegaron 50 items y todos se insertaron— pero **no hubo pérdida de escuchas**: era la primera vez, sin cursor previo, así que todo lo que devolvió Spotify era necesariamente nuevo. La heurística confunde "primera carga" con "se desbordó la ventana".

Importa porque `gapSuspectedAt` se escribe y nunca se limpia. El panel de salud de la Task 15 mostraría una alerta de posible pérdida de datos desde el primer día y de forma permanente — que es la forma más rápida de enseñar a alguien a ignorar las alertas.

**Files:**
- Modify: `src/lib/capture/run-capture.ts`

- [ ] **Step 1: Condicionar la detección a que exista cursor previo**

En `runCapture`, la línea que calcula el hueco es:

```ts
    const hayHueco = items.length === LIMITE && inserted === filas.length && filas.length > 0;
```

Sustitúyela por:

```ts
    // Un hueco significa que la ventana de 50 se desbordó entre dos ejecuciones.
    // En la primera, sin cursor previo, todo lo que devuelve Spotify es nuevo por
    // definición: eso es una carga inicial, no una pérdida. Sin esta condición la
    // alerta se enciende el primer día y no se apaga nunca.
    const primeraEjecucion = !estado?.lastPlayedAt;
    const hayHueco =
      !primeraEjecucion &&
      items.length === LIMITE &&
      inserted === filas.length &&
      filas.length > 0;
```

- [ ] **Step 2: Limpiar la marca cuando una ejecución va bien**

`gapSuspectedAt` se escribe pero nunca se borra, así que una alerta legítima también quedaría encendida para siempre. En la llamada a `guardarEstado` de la ruta de éxito, sustituye:

```ts
      ...(hayHueco ? { gapSuspectedAt: Date.now() } : {}),
```

por:

```ts
      // Se limpia en una ejecución sana: si no, la primera alerta legítima
      // quedaría encendida de forma permanente y dejaría de significar nada.
      gapSuspectedAt: hayHueco ? Date.now() : null,
```

- [ ] **Step 2b: Cerrar las dos vías por las que `runCapture` sí puede lanzar**

Detectado en la revisión de la Task 12. El contrato de esta función es que los errores se registran y se devuelven, nunca se lanzan — el cron necesita un resultado, no una traza. Pero quedan dos huecos:

1. `leerEstado()` se llama **antes** del `try`. Si esa lectura falla, la excepción escapa sin registrar nada.
2. Si `guardarEstado()` falla dentro del `catch`, esa segunda excepción también escapa, y encima sustituye al error original, que se pierde.

Mueve la lectura del estado dentro del `try`. La estructura pasa a ser:

```ts
export async function runCapture(manual = false): Promise<CaptureResult> {
  try {
    const estado = await leerEstado();

    if (
      !manual &&
      estado?.lastRunAt &&
      Date.now() - estado.lastRunAt < MIN_ENTRE_EJECUCIONES_MS
    ) {
      return {
        status: "omitida",
        inserted: 0,
        fetched: 0,
        snapshots: 0,
        message: "Otra ejecución acaba de correr.",
      };
    }

    const timeZone = resolveTimeZone(process.env);
    // …resto del cuerpo sin cambios…
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // Si además falla el guardado del error, no se propaga: perderíamos el
    // error original y el cron recibiría una traza en vez de un resultado.
    try {
      await guardarEstado({ lastRunStatus: "error", lastError: message });
    } catch (e2) {
      console.error("[captura] no se pudo registrar el error", e2);
    }
    return { status: "error", inserted: 0, fetched: 0, snapshots: 0, message };
  }
}
```

**No cambies nada más del cuerpo:** ni el cursor, ni la heurística de hueco (más allá de lo del Step 1), ni las llamadas a `spotifyFetchHeadless`, `mapRecentlyPlayed` o `insertStreams`.

- [ ] **Step 3: Corregir el estado ya guardado**

La base real ya tiene una fila con `last_run_status = 'gap'` y `gap_suspected_at` puesto, por la ejecución de prueba de la Task 14. Limpiarla:

```bash
node -e "const D=require('better-sqlite3');const d=new D('data/ledger.db');const r=d.prepare(\"UPDATE capture_state SET gap_suspected_at = NULL, last_run_status = 'ok' WHERE id = 1 AND last_run_status = 'gap'\").run();console.log('filas corregidas:',r.changes)"
```

Es la única escritura autorizada sobre `data/ledger.db` en todo el plan, y toca solo la fila de estado — no las escuchas.

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: sin errores, 76 tests.

Y comprobar que una ejecución nueva ya no marca hueco:

```bash
SECRET=$(grep '^CRON_SECRET=' .env.local | cut -d= -f2)
sleep 31 && curl -s -X POST -H "x-cron-secret: $SECRET" http://127.0.0.1:3000/api/cron/capture
```

Expected: `"status":"ok"`, y `gap_suspected_at` a `NULL` en la base.

- [ ] **Step 5: Commit**

```bash
git add src/lib/capture/run-capture.ts
git commit -m "fix: no marcar hueco en la primera ejecución de captura"
```

---

## Task 20: Cerrar los huecos del test de paridad

Surge de la revisión de calidad de la Task 18, que demostró ejecutando código que el test promete más de lo que detecta.

**Files:**
- Modify: `tests/schema-parity.test.ts`

- [ ] **Step 1: Tabla que existe solo en el DDL**

El test descubre las tablas recorriendo `Object.values(schema)` — las definiciones de Drizzle — y solo compara las que encuentra ahí. Una tabla añadida al DDL sin su `sqliteTable()` correspondiente es **completamente invisible**: el revisor añadió una y el test siguió pasando sin señalar nada.

Añade al `describe` existente:

```ts
  it("no hay tablas en el DDL que falten en Drizzle", () => {
    const { sqlite } = createTestDb();

    const enSqlite = (
      sqlite
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' " +
            "AND name NOT LIKE 'sqlite_%'",
        )
        .all() as { name: string }[]
    ).map((f) => f.name);

    const enDrizzle = new Set(tablas.map((t) => getTableConfig(t).name));

    // La comparación por columnas solo recorre tablas que ya existen en
    // Drizzle, así que una tabla creada únicamente en el DDL no la ve nadie.
    const soloEnDdl = enSqlite.filter((n) => !enDrizzle.has(n));
    expect(soloEnDdl).toEqual([]);
  });
```

Para que `tablas` sea visible desde este test, súbelo del cuerpo del primer `it` al ámbito del `describe` si no lo está ya.

- [ ] **Step 2: Pérdida de un UNIQUE**

El test compara nombres de columna y nulabilidad, pero no restricciones de unicidad. El revisor simuló quitar el `UNIQUE` de `dedup_key` dejando el `.unique()` en Drizzle: el test no dijo nada, y una segunda inserción con clave duplicada pasó.

Eso importa más que ningún otro tipo de divergencia aquí, porque **toda la idempotencia de la ingesta depende de esa restricción**. Sin ella, reimportar un archivo del dump duplica cada fila en silencio.

```ts
  it("las columnas únicas en Drizzle lo son también en el DDL", () => {
    const { sqlite } = createTestDb();
    const problemas: string[] = [];

    for (const tabla of tablas) {
      const config = getTableConfig(tabla);

      const indices = sqlite
        .prepare(`PRAGMA index_list(${config.name})`)
        .all() as { name: string; unique: number }[];

      // Columnas cubiertas por algún índice único de una sola columna.
      const unicasEnSqlite = new Set<string>();
      for (const idx of indices.filter((i) => i.unique === 1)) {
        const cols = sqlite
          .prepare(`PRAGMA index_info(${idx.name})`)
          .all() as { name: string }[];
        if (cols.length === 1) unicasEnSqlite.add(cols[0].name);
      }

      for (const col of config.columns) {
        if (!col.isUnique) continue;
        if (!unicasEnSqlite.has(col.name)) {
          problemas.push(
            `${config.name}.${col.name}: única en Drizzle pero sin UNIQUE en el DDL`,
          );
        }
      }
    }

    expect(problemas).toEqual([]);
  });
```

- [ ] **Step 3: Quitar el número mágico**

`expect(tablas.length).toBeGreaterThanOrEqual(11)` deja de significar nada en cuanto se añada la tabla número doce, y nadie tendrá motivo para actualizarlo. Átalo al DDL:

```ts
  it("compara todas las tablas del esquema", () => {
    const enDdl = (SCHEMA_SQL.match(/CREATE TABLE/g) ?? []).length;
    expect(tablas.length).toBe(enDdl);
  });
```

Necesitarás `import { SCHEMA_SQL } from "@/db/schema-sql";`.

- [ ] **Step 4: Sustituir el try/catch por `isTable`**

`getTableConfigSeguro` usa una excepción para discriminar tipos. `drizzle-orm` ya exporta un predicado real, y usarlo elimina el riesgo de que un error interno legítimo se trague y se interprete como "no es una tabla":

```ts
import { isTable } from "drizzle-orm";

const tablas = Object.values(schema).filter(isTable) as Parameters<
  typeof getTableConfig
>[0][];
```

Borra `getTableConfigSeguro` por completo.

- [ ] **Step 5: Demostrar que cada test nuevo detecta lo que promete**

Para cada uno de los dos primeros, introduce la divergencia a mano, comprueba que el test falla señalándola, y deshaz el cambio:

1. Añade una tabla al `SCHEMA_SQL` sin su definición Drizzle → debe fallar el test del Step 1 nombrándola.
2. Quita `UNIQUE` de `dedup_key` en el DDL dejando `.unique()` en Drizzle → debe fallar el test del Step 2 nombrando `streams.dedup_key`.

**Un test que no se ha visto fallar no es un test.** Reporta los dos mensajes de fallo.

- [ ] **Step 6: Verificar y commitear**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: sin errores, toda la suite en verde.

```bash
git add tests/schema-parity.test.ts
git commit -m "test: detectar tablas solo en el DDL y pérdidas de UNIQUE"
```

---

## Verificación final

- [ ] **Todos los tests pasan**

Run: `npm test`
Expected: todos los archivos en verde (`sanity`, `normalize`, `local-time`, `range`, `schema`, `map-recently-played`, `streams`).

- [ ] **Tipos y lint limpios**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **La app compila**

Run: `npm run build`
Expected: build correcto.

- [ ] **Nada de lo existente se rompió**

Con `npm run dev`, recorre `/`, `/library`, `/stats`, `/tags`, `/smart` y `/debug`.
Expected: todo funciona igual que antes de empezar.

- [ ] **La captura funciona de punta a punta**

`/ajustes` muestra escuchas capturadas, última ejecución reciente y sin errores.

---

## Qué queda fuera de este plan

Las fases 3 a 6 del diseño, que irán en planes posteriores:

- **Fase 3** — importador del dump GDPR (tablas ya creadas aquí, sin usar todavía)
- **Fase 4** — módulos de estadísticas (`tops`, `totals`, `detail`, `time`, `streaks`, `skips`, `history`, `genres`)
- **Fase 5** — reestructuración de rutas, portada, selector de rango, gráficas
- **Fase 6** — tarjetas `next/og`, playlists desde tops, y la vista que contrasta los tops de la API con los propios

Las tablas `import_batches` y `artist_resolution` se crean en la Task 6 pero no se usan hasta esas fases. Se crean ahora para que el esquema quede completo de una vez y no haya que tocar el DDL en cada plan. `top_snapshots` sí se empieza a llenar aquí (Task 13), aunque la vista que la explota llegue en la Fase 6: una serie temporal solo sirve si se empieza a acumular pronto.
