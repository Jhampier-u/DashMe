# Auditoría de Código — Ledger / Voidtify

> Organizador editorial de bibliotecas de Spotify.
> **Rol:** Ingeniero de Software Principal · Arquitecto de Soluciones · QA.
> **Metodología:** análisis iterativo por bloques (cimientos → superficie). Cada bloque se audita en 5 ejes: bugs, rendimiento, código limpio, propuestas y refactor.
> **Fecha de inicio:** 2026-07-02.

---

## Estado del proyecto (contexto técnico)

- **Stack:** Next.js 16.2.4 (App Router + Turbopack), React 19, TypeScript 5, Tailwind v4, Auth.js v5 (beta), SQLite + Drizzle ORM, Last.fm API.
- **`node_modules` NO instalado** al momento de la auditoría → no se pudieron leer los docs del fork (`node_modules/next/dist/docs/`). Las afirmaciones sobre convenciones de Next se basan en Next 16 estándar.
- Filosofía local-first: caché en SQLite (`data/ledger.db`), sin librerías de UI, todo a mano.

---

## Progreso de la auditoría

| Bloque | Área | Estado |
|---|---|---|
| 1 | Cimientos: Auth, Config & Middleware | ✅ Completado |
| 2 | Capa de Datos (SQLite / Drizzle) | ✅ Completado |
| 3 | Cliente Spotify & Rate Limiting | ✅ Completado |
| 4 | Server Actions & Lógica de Dominio | ✅ Completado |
| 5 | Rutas / Server Components | ✅ Completado |
| 6 | Componentes Cliente / UI & Estado | ✅ Completado |

---

## Mapa del proyecto

```
CONFIG & BOOTSTRAP
  next.config.ts · tsconfig · eslint.config.mjs · postcss
  src/proxy.ts            → middleware edge (localhost → 127.0.0.1)   [convención Next 16]
  src/app/layout.tsx      → root layout, fuentes (Fraunces + JetBrains Mono)
  src/app/globals.css     → theme tokens, grano, animaciones

AUTENTICACIÓN
  src/auth.ts             → NextAuth (Spotify OAuth), refresh token, monkeypatch de fetch
  src/app/api/auth/[...nextauth]/route.ts → handlers GET/POST

CAPA DE DATOS (SQLite / Drizzle)
  src/db/index.ts         → conexión, WAL, auto-CREATE TABLE idempotente
  src/db/schema.ts        → artists · tags · track_tags · liked_tracks · smart_playlists

SERVICIOS / INTEGRACIÓN EXTERNA
  src/lib/rate-limiter.ts → TokenBucket global (250ms), singleton en globalThis
  src/lib/spotify.ts      → fetch<T> con retry/backoff 429/5xx, tipos + endpoints (Feb 2026 /items)
  src/lib/lastfm.ts       → tags de género (fuente primaria)
  src/lib/spotify-actions.ts → "use server": CRUD tracks/playlists, merge, dedupe, reorder
  src/lib/genre-actions.ts   → enriquecimiento híbrido (cache→LastFM→Spotify), 6 workers
  src/lib/liked-cache.ts     → persistencia de Liked Songs
  src/lib/tag-actions.ts     → CRUD tags + track_tags
  src/lib/tags.ts            → tipos/constantes puros
  src/lib/smart-rules.ts     → evaluación PURA de reglas
  src/lib/smart-actions.ts   → CRUD + materialize (escribe en Spotify)

RUTAS (Server Components)
  app/page.tsx · library · playlist/[id] · stats · tags · smart · debug · error.tsx

COMPONENTES CLIENTE
  PlaylistTracksTable.tsx (⭐ ~1200 líneas) · StatsScanner · SmartPlaylistsManager
  TagsManager · TagPicker · TagBadge · TopBar · CreatePlaylistDialog · MergePlaylistsDialog
```

---

# BLOQUE 1 — Cimientos: Auth, Config & Middleware

**Archivos:** `src/auth.ts` · `src/app/api/auth/[...nextauth]/route.ts` · `src/proxy.ts` · `next.config.ts` · `src/app/layout.tsx` · `src/app/globals.css` · `.env.local.example`

## 🔍 Errores y Bugs Críticos

### 1.1 — Monkeypatch global de `fetch` sin guarda de idempotencia (`auth.ts:9-20`) — 🔴 Alta
El parche reemplaza `globalThis.fetch` al evaluar el módulo. Bajo HMR de Turbopack (o si el módulo se evalúa en más de un contexto/runtime), `auth.ts` se re-ejecuta: `_origFetch` captura el `fetch` **ya parcheado** y se envuelve otra vez → **wrappers anidados acumulados** por cada recarga. Cada petición del app (Spotify, Last.fm, internas de Next) atraviesa N capas → degradación progresiva. Además: tipado `any` (pierde seguridad de tipos) y solo maneja `init.body` (si Auth.js pasara un `Request`, el body no se inspecciona).

**Solución** — guarda idempotente + tipado + salida temprana:
```ts
const PATCHED = Symbol.for("ledger.spotifyTokenFetchPatched");
type G = typeof globalThis & { [PATCHED]?: true };
if (!(globalThis as G)[PATCHED]) {
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url?.includes("accounts.spotify.com/api/token") &&
        typeof init?.body === "string" && init.body.includes("localhost")) {
      init = { ...init, body: init.body.replaceAll("localhost", "127.0.0.1") };
    }
    return origFetch(input, init);
  };
  (globalThis as G)[PATCHED] = true;
}
```
**Propuesta de fondo:** el binding `-H 127.0.0.1` + `AUTH_URL=http://127.0.0.1:3000` ya deberían evitar el `localhost` en el token exchange. Verificar si el parche sigue siendo necesario en 16.2.4; si lo es, moverlo a `token.request` del provider en vez de tocar el `fetch` global.

### 1.2 — Refresh de token propaga `accessToken` caduco y es propenso a carrera (`auth.ts:90-101`) — 🔴 Alta
Al fallar el refresh se retorna `{ ...token, error: "RefreshTokenError" }` conservando el `accessToken` expirado; cualquier ruta que no revise `session.error` lo usará → 401. Además, si varias requests entran a `jwt()` con el token vencido a la vez, cada una dispara su propio refresh; Spotify **rota el `refresh_token`**, invalidando los demás en vuelo → fallos en cascada.

**Solución mínima (defensa en profundidad):**
```ts
} catch (e) {
  console.error("Token refresh failed", e);
  return { ...token, accessToken: undefined, error: "RefreshTokenError" };
}
```
Solución robusta (opcional): single-flight/mutex de refresh para deduplicar refrescos concurrentes.

### 1.3 — Fraunces se carga SIN la variante itálica (`layout.tsx:5-10`) — 🟠 Media
Toda la estética depende de `.display-italic` (`font-style: italic`), pero `next/font/google` solo trae el estilo *normal* porque no se declara `style`. Resultado probable: **itálica falsa (sintética)** en todos los titulares en vez de la itálica real de Fraunces. *(Requiere confirmación visual; es el gotcha clásico de `next/font` con fuentes variables.)*

**Solución:**
```ts
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],   // ← trae la itálica real
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
});
```

## ⚡ Optimización y Rendimiento
- Overhead por request del parche de `fetch` (hoy `url.includes` en cada llamada, incluidas internas de Next y Last.fm). La corrección de 1.1 (guarda + salida temprana) lo neutraliza.
- `session()` no debe propagar el token caduco (ver 1.2) para evitar 401 y reintentos que sí cuestan red.
- `.font-serif` / `.font-mono` duplicados (`globals.css:63-68`): en Tailwind v4 las claves `--font-serif`/`--font-mono` del `@theme` **ya generan** esas utilidades; redefinirlas a mano es redundante.

## 🎨 Código Limpio y Buenas Prácticas
- Casts redundantes en `auth.ts` (`token.expiresAt as number`, etc.): el `declare module "next-auth/jwt"` ya tipa esos campos.
- `checks: ["state"]` (`auth.ts:68`) desactiva PKCE. Spotify lo soporta → `["pkce", "state"]` es más seguro.
- `proxy.ts` — `host.startsWith("localhost")` haría match con `localhostfoo`; usar `host === "localhost" || host.startsWith("localhost:")`.
- Sin validación en runtime de variables de entorno → si falta `SPOTIFY_CLIENT_ID`, `clientId` es `undefined` y el fallo aparece tarde y confuso.

## 🚀 Propuestas de Mejora
1. **Validación de entorno al arranque** (`src/env.ts`) que falle rápido y claro.
2. **Accesibilidad — `prefers-reduced-motion`** en `globals.css` (el `marquee` corre en bucle infinito 60s):
   ```css
   @media (prefers-reduced-motion: reduce) {
     .marquee-track, .rise, .fade-in { animation: none; }
   }
   ```
3. **Cabeceras de seguridad** en `next.config.ts` (`async headers()`): CSP básica, `X-Content-Type-Options`, `Referrer-Policy` — relevante por el uso de `dangerouslySetInnerHTML` con datos de Spotify (se audita en Bloque 5).

## ✅ Verificado (NO son bugs)
- `proxy.ts` con `export function proxy` + `export const config` = **convención de middleware correcta en Next 16**.
- `url.host = "127.0.0.1"` **preserva el puerto** (`http://127.0.0.1:3000/...`) — comprobado con Node.

## Resumen Bloque 1
| Severidad | Hallazgo |
|---|---|
| 🔴 Alta | Patch de `fetch` sin idempotencia (acumula wrappers en HMR) |
| 🔴 Alta | Refresh propaga `accessToken` caduco; carrera en rotación de refresh_token |
| 🟠 Media | Fraunces itálica no cargada (`style` ausente) |
| 🟠 Media | Sin PKCE; sin validación de env |
| 🟡 Baja | `.font-serif/.font-mono` duplicados; `startsWith("localhost")`; casts redundantes; a11y |

---

# BLOQUE 2 — Capa de Datos (SQLite / Drizzle)

**Archivos:** `src/db/index.ts` · `src/db/schema.ts`

## 🔍 Errores y Bugs Críticos

### 2.1 — Fuga de conexiones a SQLite en desarrollo (HMR) (`db/index.ts:13`) — 🔴 Alta
`db/index.ts` abre `new Database(DB_PATH)` al evaluar el módulo, **sin singleton en `globalThis`**. En dev con HMR, cada recarga que toque la cadena de imports re-evalúa el módulo → **nueva conexión `better-sqlite3` sin cerrar la anterior**. Acumula file handles y, con WAL, múltiples conexiones escritoras aumentan el riesgo de `SQLITE_BUSY`. Nota: `rate-limiter.ts` ya aplica el patrón singleton correcto (`globalThis.__spotifyRateLimiter`) — la capa de datos debería imitarlo.

**Solución:**
```ts
declare global {
  // eslint-disable-next-line no-var
  var __ledgerDb: ReturnType<typeof createDb> | undefined;
}
function createDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.exec(`/* CREATE TABLE IF NOT EXISTS ... */`);
  return drizzle(sqlite, { schema });
}
export const db = globalThis.__ledgerDb ?? (globalThis.__ledgerDb = createDb());
```

### 2.2 — Sin sistema de migraciones → deriva de esquema (drift) — 🔴 Alta
`drizzle-kit` está en devDependencies pero **no hay `drizzle.config.ts`, ni carpeta de migraciones, ni scripts `db:*`** (verificado). El esquema se crea con `CREATE TABLE IF NOT EXISTS` en `index.ts`. Consecuencias:
- Si `schema.ts` cambia (nueva columna, tipo distinto), el `IF NOT EXISTS` **no altera** las tablas existentes → las DB de usuarios ya creadas conservan el esquema viejo → errores en runtime o columnas ausentes, en silencio.
- **Doble fuente de verdad**: el DDL de `index.ts` y el `schema.ts` de Drizzle deben mantenerse sincronizados a mano (hoy coinciden, pero pueden divergir).

**Propuesta:** ver sección 🚀 (wiring de drizzle-kit).

### 2.3 — `JSON.parse` sin protección sobre columnas TEXT — 🟠 Media
El esquema guarda JSON como TEXT y el parseo es manual y disperso. Dos sitios **sin try/catch** rompen ante una fila corrupta o de un esquema legacy:
- `liked-cache.ts:31` → `JSON.parse(r.artistsJson)` dentro de `.map()` en `getCachedLikedTracks`: una sola fila mala **tumba toda la lectura** del caché de Liked Songs (afecta Stats y materialize).
- `genre-actions.ts:47` → `JSON.parse(row.genres)`: una fila mala **rompe todo el lookup de géneros**.

(Los de `smart-actions.ts:30` y `:184` sí están protegidos.) La causa raíz es de diseño de esquema → se ataca con `mode: 'json'` (ver 2.6 y refactor).

## ⚡ Optimización y Rendimiento
- **`PRAGMA busy_timeout` ausente:** con WAL los lectores concurrentes van bien, pero dos escrituras que compitan (p. ej. materialize + aplicar tag) pueden lanzar `SQLITE_BUSY`. Añadir `busy_timeout = 5000` da resiliencia barata.
- **`better-sqlite3` es síncrono:** todas las queries bloquean el event loop. Aceptable para app personal de un usuario, pero `getCachedLikedTracks` lee miles de filas de golpe; tenerlo presente si crece el volumen.
- **`fs.existsSync(DATA_DIR)` redundante:** `mkdirSync(..., { recursive: true })` ya es idempotente y no lanza si existe → el guard sobra.

## 🎨 Código Limpio y Buenas Prácticas
- **JSON como TEXT + parse manual** (artists.genres, liked_tracks.artists_json, smart_playlists.rules_json): Drizzle ofrece `text('...', { mode: 'json' }).$type<T>()` que centraliza parse/stringify y da tipos. Elimina los `JSON.parse ... as T` repartidos por 4 archivos.
- **`explicit: integer` como 0/1** con conversión manual (`explicit ? 1 : 0` / `Boolean(r.explicit)`): usar `integer('explicit', { mode: 'boolean' })`.
- **Timestamps `integer` (ms)** sin `{ mode: 'timestamp_ms' }`: consistente y simple hoy; opcional migrar a `Date` tipado.
- **Sintaxis de índices deprecada:** el callback `(t) => ({ pk: ..., byTag: ... })` (objeto) está deprecado en Drizzle moderno a favor del **array** `(t) => [primaryKey(...), index(...)]`. Verificar contra 0.45.2 y migrar.
- **DDL duplicado** entre `index.ts` y `schema.ts` (ver 2.2): idealmente una sola fuente (schema.ts → migraciones).

## 🚀 Propuestas de Mejora
1. **Cablear drizzle-kit** (elimina 2.2):
   - `drizzle.config.ts` apuntando a `src/db/schema.ts` y `dialect: 'sqlite'`.
   - Scripts: `"db:generate": "drizzle-kit generate"`, `"db:migrate": "drizzle-kit migrate"`, `"db:push": "drizzle-kit push"`.
   - Reemplazar el `CREATE TABLE IF NOT EXISTS` de `index.ts` por un runner de migraciones al arranque (`migrate(db, { migrationsFolder })`).
2. **Singleton de `db` en `globalThis`** (elimina 2.1).
3. **Columnas JSON tipadas** con `mode: 'json'` + `.$type<>()` (elimina 2.3 en la raíz).
4. **Limpieza de tags huérfanos:** `track_tags.track_uri` no referencia ninguna tabla local (los tracks viven en Spotify), así que se acumulan tags de URIs que ya no existen. Considerar una acción de mantenimiento opcional.

## 💻 Código Refactorizado (fragmentos clave)

**`schema.ts` — JSON/boolean tipados + índices en array:**
```ts
import { sqliteTable, text, integer, primaryKey, index } from "drizzle-orm/sqlite-core";

export const artists = sqliteTable("artists", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  genres: text("genres", { mode: "json" }).$type<string[]>().notNull().default([]),
  updatedAt: integer("updated_at").notNull(),
});

export const likedTracks = sqliteTable("liked_tracks", {
  uri: text("uri").primaryKey(),
  name: text("name").notNull(),
  artists: text("artists_json", { mode: "json" }).$type<{ id: string; name: string }[]>().notNull(),
  albumId: text("album_id"),
  albumName: text("album_name"),
  albumImage: text("album_image"),
  durationMs: integer("duration_ms").notNull().default(0),
  explicit: integer("explicit", { mode: "boolean" }).notNull().default(false),
  addedAt: text("added_at"),
  scannedAt: integer("scanned_at").notNull(),
}, (t) => [index("liked_tracks_added_at_idx").on(t.addedAt)]);

export const trackTags = sqliteTable("track_tags", {
  trackUri: text("track_uri").notNull(),
  tagId: integer("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
  addedAt: integer("added_at").notNull(),
}, (t) => [
  primaryKey({ columns: [t.trackUri, t.tagId] }),
  index("track_tags_tag_idx").on(t.tagId),
]);
```
Con esto, `getCachedLikedTracks` y `getArtistGenres` dejan de hacer `JSON.parse(...) as T` (Drizzle devuelve ya el tipo), cerrando 2.3.

**`drizzle.config.ts` (nuevo):**
```ts
import { defineConfig } from "drizzle-kit";
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: "./data/ledger.db" },
});
```

## Resumen Bloque 2
| Severidad | Hallazgo |
|---|---|
| 🔴 Alta | Fuga de conexiones SQLite en HMR (sin singleton globalThis) |
| 🔴 Alta | Sin migraciones → drift de esquema; doble fuente de verdad (DDL vs schema.ts) |
| 🟠 Media | `JSON.parse` sin try/catch en `liked-cache.ts:31` y `genre-actions.ts:47` |
| 🟡 Baja | Falta `busy_timeout`; `existsSync` redundante; JSON/boolean sin `mode:`; índices en sintaxis deprecada |

---

# BLOQUE 3 — Cliente Spotify & Rate Limiting

**Archivos:** `src/lib/spotify.ts` · `src/lib/rate-limiter.ts` · `src/lib/lastfm.ts`

## 🔍 Errores y Bugs Críticos

### 3.1 — Reintento de mutaciones no idempotentes (POST) sobre 5xx → duplicación (`spotify.ts:30-53`) — 🔴 Alta
`spotifyFetch` reintenta ante `res.status >= 500` **sin distinguir el método HTTP**. Para un **POST** (añadir tracks, crear playlist, re-añadir en dedupe), un 5xx puede llegar *después* de que Spotify ya procesó parcialmente la petición → el reintento **duplica** tracks o crea playlists repetidas. Afecta a `addTracksToPlaylist`, `createPlaylist`, `createPlaylistFromTracks`, `mergePlaylists` y `cleanupDuplicates`.

**Regla correcta:** 429 siempre es seguro reintentar (el servidor rechazó sin actuar); 5xx solo si el método es idempotente (GET/PUT/DELETE).
```ts
const method = (init.method ?? "GET").toUpperCase();
const isIdempotent = method === "GET" || method === "PUT" || method === "DELETE";
const canRetry = res.status === 429 || (res.status >= 500 && isIdempotent);
if (canRetry && attempt < 4) { /* backoff + retry */ }
```

### 3.2 — `Retry-After` no numérico anula el backoff (`spotify.ts:31-47`) — 🟠 Media
Verificado con Node: si el header `Retry-After` llega en formato no numérico (p. ej. fecha HTTP), `parseInt` → `NaN`; como `NaN > 60` es `false`, se cae en `backoffMs = Math.max(NaN * 1000, ...) = NaN`, y `setTimeout(NaN)` se trata como **0 ms** → los reintentos se disparan **sin espera**, martillando a Spotify justo cuando pide calma. Spotify usa segundos enteros (baja probabilidad), pero es un bug latente.

**Solución:**
```ts
const parsed = parseInt(res.headers.get("Retry-After") ?? "", 10);
const retryAfterSec = Number.isFinite(parsed) ? parsed : 0;
```

### 3.3 — Respuesta de Last.fm `tags.tag` puede no ser un array (`lastfm.ts:59-63`) — 🟠 Media
Last.fm en JSON devuelve `tags.tag` como **array cuando hay varios tags, pero como objeto único cuando hay uno solo** (inconsistencia conocida de su API). `tags.slice(0, 6)` sobre un objeto lanza excepción → cae en el `catch` → retorna `[]` en silencio. Resultado: **un artista con un solo tag pierde su género**. Además `t.name` se asume presente.

**Solución (normalizar forma):**
```ts
const raw = data.artist?.tags?.tag;
const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
return list
  .slice(0, MAX_TAGS_PER_ARTIST)
  .map((t) => t?.name?.toLowerCase().trim() ?? "")
  .filter((t) => t.length > 0 && !GENERIC_TAGS.has(t));
```

## ⚡ Optimización y Rendimiento

### 3.4 — Last.fm SIN rate limiter + 6 workers en paralelo — 🟠 Media
`getArtistTagsByName` usa `fetch` crudo, **sin pasar por ningún limitador**. Pero `genre-actions.ts` lanza **6 workers concurrentes**, cada uno llamando a Last.fm → hasta 6 peticiones simultáneas contra el límite (~5 req/s por key) de Last.fm. Al exceder, Last.fm responde 429, que aquí se traga como `[]` → **géneros vacíos que se persisten** y luego se re-consultan (ver interacción con genre-actions en Bloque 4). Propuesta: limitador dedicado para Last.fm.
```ts
// rate-limiter.ts — segundo singleton
export const lastfmLimiter =
  globalThis.__lastfmRateLimiter ??
  (globalThis.__lastfmRateLimiter = new IntervalThrottle(220)); // ~4.5 req/s
// lastfm.ts
await lastfmLimiter.acquire();
const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
```

### 3.5 — Otros
- **`auth()` en cada `spotifyFetch`**: en escaneos grandes (paginación de miles de tracks) se invoca `auth()` por request. Es el precio de tener siempre un token fresco (refresh), pero es un coste por-llamada; considerar hoistear el token en operaciones batch.
- **Sin timeout/AbortController** en los `fetch` de Spotify y Last.fm → una petición colgada estanca un worker indefinidamente. `AbortSignal.timeout(ms)` lo resuelve.
- **`cache: "no-store"` en Last.fm**: aceptable porque la caché real es la tabla `artists` (30 días).
- **Caché de Next + token rotatorio**: los GET usan `next: { revalidate, tags }`, pero el `Authorization: Bearer` cambia al refrescar → puede reducir el hit-rate de caché. Sin impacto de corrección en app monousuario.

## 🎨 Código Limpio y Buenas Prácticas
- **`TokenBucket` está mal nombrado**: no es un token bucket (que permite ráfagas hasta una capacidad); es un **throttle de intervalo mínimo** que serializa cada release ≥250ms. El README habla de "brief bursts are fine" pero **esta implementación no permite ráfagas**. Renombrar a `IntervalThrottle`/`MinIntervalLimiter` y corregir el comentario.
- **`as Error & { status?: number }` repetido** en varios sitios → centralizar una clase `SpotifyError extends Error { status?: number; retryAfterSec?: number }`.
- **`GENERIC_TAGS` se define después de usarse** (`lastfm.ts`): funciona por hoisting temporal (el `const` ya está inicializado en tiempo de llamada), pero conviene declararlo antes para lectura lineal.
- **Limiter es per-proceso**: singleton en `globalThis` de un solo proceso Node. Con múltiples workers/instancias el cap global se puede exceder. Correcto para uso personal local; documentarlo.

## 🚀 Propuestas de Mejora
1. **`SpotifyError` centralizado** con `status`/`retryAfterSec`; simplifica el manejo en `error.tsx` y en las actions.
2. **Reintento consciente de idempotencia** (3.1) + **`Retry-After` robusto** (3.2).
3. **Limitador dedicado para Last.fm** (3.4) + **timeouts con `AbortSignal.timeout`** en ambos clientes.
4. **Normalización de la forma de Last.fm** (3.3) reutilizable.
5. **Opcional:** permitir una pequeña ráfaga (token bucket real con capacidad 2-3) para mejorar latencia percibida sin superar la ventana rodante de Spotify.

## 💻 Código Refactorizado (fragmentos clave)

**`spotify.ts` — retry idempotente + Retry-After robusto:**
```ts
const method = (init.method ?? "GET").toUpperCase();
const isIdempotent = method === "GET" || method === "PUT" || method === "DELETE";
const canRetry = res.status === 429 || (res.status >= 500 && isIdempotent);

if (canRetry && attempt < 4) {
  const parsed = parseInt(res.headers.get("Retry-After") ?? "", 10);
  const retryAfterSec = Number.isFinite(parsed) ? parsed : 0;
  const MAX_AUTO_WAIT_S = 60;
  if (retryAfterSec > MAX_AUTO_WAIT_S) {
    const err = new Error(`Spotify rate limit: ${Math.ceil(retryAfterSec / 60)} min de espera.`) as SpotifyError;
    err.status = 429; err.retryAfterSec = retryAfterSec; throw err;
  }
  const backoffMs = Math.max(retryAfterSec * 1000, Math.min(30_000, 500 * 2 ** attempt));
  await sleep(backoffMs);
  return spotifyFetch<T>(path, init, attempt + 1);
}
```

**`lastfm.ts` — normalización + guardas + timeout:**
```ts
const res = await fetch(`${LASTFM_API}?${params}`, {
  cache: "no-store",
  signal: AbortSignal.timeout(8000),
});
// ...
const raw = data.artist?.tags?.tag;
const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
return list
  .slice(0, MAX_TAGS_PER_ARTIST)
  .map((t) => t?.name?.toLowerCase().trim() ?? "")
  .filter((t) => t.length > 0 && !GENERIC_TAGS.has(t));
```

## ✅ Verificado (NO son bugs)
- El throttle serializa correctamente (FIFO, `lastReleased` desde el *release*, primer acquire inmediato).
- Los bodies son siempre `string` (`JSON.stringify`), así que reintentar reusando `init` es seguro (no hay streams consumidos).

## Resumen Bloque 3
| Severidad | Hallazgo |
|---|---|
| 🔴 Alta | Reintento de POST sobre 5xx → duplicación de tracks/playlists |
| 🟠 Media | `Retry-After` no numérico → backoff `NaN` → reintento inmediato |
| 🟠 Media | Last.fm `tags.tag` no-array (1 tag) → género perdido en silencio |
| 🟠 Media | Last.fm sin limitador + 6 workers → ráfagas > límite → 429 tragado |
| 🟡 Baja | `TokenBucket` mal nombrado; sin timeouts; `SpotifyError` no centralizado; limiter per-proceso |

---

# BLOQUE 4 — Server Actions & Lógica de Dominio

**Archivos:** `src/lib/spotify-actions.ts` · `src/lib/genre-actions.ts` · `src/lib/smart-actions.ts` · `src/lib/liked-cache.ts` · `src/lib/tag-actions.ts` · `src/lib/smart-rules.ts`

> Recordatorio de arquitectura: cada función `"use server"` exportada es un **endpoint HTTP público** (POST con action-id). Cualquiera que alcance el servidor puede invocarla directamente, no solo la UI. Por eso **cada action debe verificar auth por sí misma**.

## 🔍 Errores y Bugs Críticos

### 4.1 — Server Actions de DB local SIN autenticación — 🔴 Alta (defensa en profundidad; crítica si se expone)
Verificado: `tag-actions.ts`, `liked-cache.ts` y `genre-actions.ts` **no llaman a `auth()` ni pasan por `spotifyFetch`** → tocan SQLite directamente sin ninguna comprobación. `smart-actions.ts` solo autentica el *write* a Spotify de `materialize`; todo su CRUD de DB va sin auth. Implicaciones si el server es alcanzable (túnel, LAN, deploy):
- Cualquiera puede **leer** todo el caché de Liked Songs (`getCachedLikedTracks`), **borrarlo** (`clearLikedCache`), **crear/renombrar/eliminar tags** y smart playlists, y **martillar Last.fm** vía `getArtistGenres`.
- El binding a `127.0.0.1` reduce el riesgo hoy, pero es una brecha real de autorización.

**Solución** — helper compartido y aplicarlo al inicio de cada action de DB:
```ts
// src/lib/require-session.ts
import "server-only";
import { auth } from "@/auth";
export async function requireSession() {
  const session = await auth();
  if (!session?.accessToken) throw new Error("No autenticado");
  return session;
}
```
```ts
// en cada action (tag-actions, smart-actions, liked-cache, genre-actions):
export async function listTags(): Promise<Tag[]> {
  await requireSession();
  /* ... */
}
```

### 4.2 — `materializeSmartPlaylist`: no persiste el ID tras crear → playlists huérfanas (`smart-actions.ts:200-250`) — 🔴 Alta
Cuando la smart playlist aún no tiene `spotifyPlaylistId`, se hace `POST /me/playlists` (crea) y solo se guarda el ID **al final** (paso 7), después de todos los PUT/POST de contenido. Si un chunk posterior falla, el ID **nunca se guarda** → al reintentar se **crea otra playlist** → se acumulan playlists huérfanas vacías/parciales en la cuenta del usuario.

**Solución** — persistir el ID inmediatamente tras crear:
```ts
let playlistId = smart.spotifyPlaylistId;
if (!playlistId) {
  const created = await spotifyFetch<{ id: string }>(`/me/playlists`, { method: "POST", body: /* ... */ });
  playlistId = created.id;
  // Enlazar de inmediato: si algo falla luego, el reintento reutiliza esta playlist.
  await db.update(smartPlaylists)
    .set({ spotifyPlaylistId: playlistId, updatedAt: Date.now() })
    .where(eq(smartPlaylists.id, id));
}
```

### 4.3 — `setTagsForTrack`: delete + insert sin transacción → pérdida de tags (`tag-actions.ts:141-151`) — 🟠 Media
`db.delete(trackTags).where(trackUri)` seguido de `db.insert(...)`. Si el insert falla, el delete **ya se confirmó** → la canción queda **sin ningún tag**. Debe ser atómico.
```ts
db.transaction((tx) => {
  tx.delete(trackTags).where(eq(trackTags.trackUri, uri)).run();
  if (tagIds.length > 0) {
    tx.insert(trackTags).values(tagIds.map((tagId) => ({ trackUri: uri, tagId, addedAt: Date.now() }))).run();
  }
});
```

### 4.4 — `cleanupDuplicates`: forma de DELETE antigua e inconsistente (`spotify-actions.ts:117-123`) — 🟠 Media
Usa `DELETE /playlists/{id}/items?uris=a,b,c` (query string), mientras que `removeTracksFromPlaylist` usa el **body** `{ items: [{uri}] }` que el propio README documenta como el contrato Feb 2026. Dos formas de DELETE distintas en el mismo archivo → riesgo de que la de `cleanupDuplicates` falle o se comporte distinto, y con 100 URIs en la URL (~4000+ chars) hay riesgo de límite de longitud. Unificar al body form.

## ⚡ Optimización y Rendimiento

### 4.5 — `getArtistGenres`: resultados vacíos siempre tratados como stale → re-fetch infinito (`genre-actions.ts:46-53`) — 🟠 Media
`if (now - row.updatedAt < STALE_MS && genres.length > 0)`: una entrada cacheada con `genres: []` **nunca se considera fresca** → se re-consulta en **cada** análisis. Los artistas sin tags en Last.fm ni géneros en Spotify se re-piden eternamente, desperdiciando API y presión de rate (interactúa con 3.4). Además, el comentario `// 6 workers ≈ 30 req/s ... bajo Spotify's 180/30s` razona sobre **Spotify**, pero la carga real ahora es **Last.fm** (~5 req/s) → justificación obsoleta.

**Solución** — cachear vacíos con TTL corto de reintento:
```ts
const EMPTY_RETRY_MS = 7 * 24 * 60 * 60 * 1000; // reintentar vacíos cada 7 días, no siempre
for (const row of cached) {
  const genres = safeParseArray(row.genres);
  const ttl = genres.length > 0 ? STALE_MS : EMPTY_RETRY_MS;
  if (now - row.updatedAt < ttl) fresh.set(row.id, genres);
}
```

### 4.6 — `inArray` sin chunk en `tag-actions` (inconsistente con `smart-actions`) — 🟡 Baja/Media
`smart-actions.ts` chunkea sus lecturas `inArray` a 500 (`:158`, `:181`), pero `tag-actions.getTagsForTracks` (`:85`) y `removeTagFromTracks` (`:135`) pasan **todos los URIs de golpe**. Con playlists grandes (hasta 10 000 tracks) y builds antiguos de SQLite (`SQLITE_MAX_VARIABLE_NUMBER = 999`) puede lanzar "too many SQL variables". `refreshTags` en el cliente pasa todos los URIs cargados. Chunkear a ≤500 por consistencia y seguridad.
```ts
const CHUNK = 500;
for (let i = 0; i < uris.length; i += CHUNK) {
  const rows = await db.select(/* ... */).where(inArray(trackTags.trackUri, uris.slice(i, i + CHUNK)));
  /* merge rows */
}
```

### 4.7 — Otros de rendimiento
- **`genre-actions` persiste 1 INSERT por artista** (`:88-104`): batcheable, aunque se dispersa naturalmente entre llamadas de red.
- **`listSmartPlaylists` hace fetch + `.reverse()` en JS** (`:47-53`): usar `orderBy(desc(smartPlaylists.updatedAt))`.
- **`moveTracksToPlaylist`** (`:87-94`) hace add-then-remove (orden seguro: sin pérdida de datos, peor caso duplicado), pero no es atómico ni distingue el error; aceptable, documentar.

## 🎨 Código Limpio y Buenas Prácticas
- **Validación inconsistente en tags**: `createTag` valida nombre no vacío, longitud ≤40 y unicidad; pero `renameTag` (`:49-56`) **no valida nada** → renombrar a un nombre existente lanza un error crudo de UNIQUE, y no hay tope de longitud. Homogeneizar (extraer un `validateTagName`).
- **`createTag` TOCTOU** (`:30-46`): check-then-insert; en carrera dos creates del mismo nombre pasan el check y el segundo revienta con error crudo. Mapear la violación UNIQUE a "Ya existe".
- **`deleteTag`** borra `track_tags` explícitamente aunque el `ON DELETE CASCADE` ya lo cubre (redundante pero inofensivo).
- **Smart rules con géneros nunca enriquecidos**: si el usuario nunca corrió "Analizar géneros", `includeGenres`/`excludeGenres` casan contra un mapa vacío → resultado silenciosamente vacío. Avisar en UI (Bloque 6).

## 🚀 Propuestas de Mejora
1. **`requireSession()` en todas las actions de DB** (4.1) — el cambio de seguridad más importante del bloque.
2. **Envolver escrituras multi-paso en `db.transaction()`**: `setTagsForTrack` (4.3), y considerar `deleteTag`.
3. **Persistir `spotifyPlaylistId` al crear** en materialize (4.2).
4. **Cachear géneros vacíos con TTL de reintento** (4.5) + corregir el comentario de PARALLELISM.
5. **Chunkear `inArray` en tag-actions** (4.6).
6. **Unificar la forma de DELETE** de tracks al body `{ items: [{uri}] }` (4.4).
7. **Validación de tags centralizada** y mapeo de errores UNIQUE a mensajes amigables.

## ✅ Verificado (NO son bugs)
- **`smart-rules.ts` es el archivo más limpio**: función pura y correcta — Fisher-Yates bien implementado, arrays vacíos tratados como no-ops (`length > 0` guard), `parseDate` robusto (ISO 8601 ordena bien), `addedBefore` exclusivo con `>=`. Solo nota menor: los `trackGenres!` (non-null assertion) podrían reestructurarse para evitar el `!`.
- **`spotify-actions.ts` sí está autenticado** (transitivo vía `spotifyFetch`).
- **Worker pool de genre-actions**: `const idx = cursor++` es síncrono (sin `await` intermedio) → no hay colisión de índices entre workers.
- **`saveLikedTracks`**: upsert `onConflictDoUpdate` con `excluded.*` correcto; chunk 200 adecuado.

## Resumen Bloque 4
| Severidad | Hallazgo |
|---|---|
| 🔴 Alta | Server actions de DB local sin `auth()` (tag/smart/liked/genre) |
| 🔴 Alta | `materialize` no persiste ID tras crear → playlists huérfanas + duplicación en reintento |
| 🟠 Media | `setTagsForTrack` sin transacción → pérdida de tags |
| 🟠 Media | `cleanupDuplicates` DELETE con `?uris=` (inconsistente/antiguo) |
| 🟠 Media | `getArtistGenres` re-fetch infinito de vacíos; comentario PARALLELISM obsoleto |
| 🟡 Baja | `inArray` sin chunk en tag-actions; `renameTag`/`createTag` validación inconsistente; `listSmartPlaylists` reverse en JS |

---

# BLOQUE 5 — Rutas / Server Components

**Archivos:** `app/page.tsx` · `app/library/page.tsx` · `app/playlist/[id]/page.tsx` · `app/stats/page.tsx` · `app/tags/page.tsx` · `app/smart/page.tsx` · `app/debug/page.tsx` · `app/error.tsx`

## 🔍 Errores y Bugs Críticos

### 5.1 — `dangerouslySetInnerHTML` con descripciones de Spotify sin sanitizar → XSS (`page.tsx:303`, `playlist/[id]/page.tsx:228`) — 🟠 Media (Alta sin CSP)
Las descripciones de playlist se renderizan como HTML crudo. En **playlists seguidas** (de otros usuarios), la descripción es **controlada por un tercero**. React escapa por defecto; usar `dangerouslySetInnerHTML` desactiva esa protección a propósito. Combinado con la ausencia de CSP (Bloque 1), cualquier vector que Spotify no filtre se ejecuta.

**Solución** — sanitizar o renderizar como texto:
```tsx
// Opción A: sanitizar (isomorphic-dompurify)
import DOMPurify from "isomorphic-dompurify";
<p dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(playlist.description) }} />

// Opción B (más simple): las descripciones de Spotify son casi siempre texto con
// entidades HTML → decodificar entidades y renderizar como texto plano.
```

### 5.2 — La UX de rate-limit de `error.tsx` NO funciona en producción (`error.tsx:16-19,41,46`) — 🟠 Media
`isRateLimit` se decide leyendo `error.message`, pero Next **redacta los mensajes de error de Server Components en producción** (los reemplaza por un genérico y solo expone `digest`). Resultado: en prod `error.message` nunca contiene "rate limit"/"429" → los usuarios **siempre ven "Algo se rompió"**, nunca la copia útil de cooldown. La UX detallada solo funciona en dev.

**Solución:** propagar la condición por un canal que sobreviva a la redacción — p. ej. capturar el 429 en el Server Component y `redirect('/rate-limited')`, o renderizar un estado dedicado en la propia ruta en lugar de depender del boundary global.

### 5.3 — Posible bug de datos: `p.items?.total` degrada a 0 en silencio (`page.tsx:134,138,260,488` + pickers) — 🟠 Media (verificar)
El índice, el destacado y los pickers (`MergePlaylistsDialog`, `PlaylistPicker`) leen el conteo de tracks como `p.items?.total ?? 0`. **Si el endpoint `/me/playlists` de Spotify aún devuelve `tracks.total`** (y solo el sub-recurso pasó a `/items`), entonces `items` es `undefined` y **todos los contadores del índice muestran 0** — sin error, por el `?.`. Asimetría reveladora: la página de detalle usa `firstPage.total` (del endpoint `/items`, correcto), pero el grid usa `items.total` del objeto de lista.

**Acción:** abrir `/debug` y mirar el JSON de "My playlists (first page)": si el conteo viene en `tracks`, ajustar el tipo `SpotifyPlaylist` y los accesos a `p.tracks?.total` (o soportar ambos: `(p.items ?? p.tracks)?.total`).

## ⚡ Optimización y Rendimiento

### 5.4 — `playlist/[id]` hace `getAllMyPlaylists()` eager en cada carga (`playlist/[id]/page.tsx:41`) — 🟠 Media
Cada visita a una playlist **pagina TODAS las playlists del usuario** solo para poblar el picker "Mover/Copiar a…" y calcular `ownedPlaylists`. Para usuarios con cientos de playlists son múltiples requests (aunque cacheados 300s) en cada apertura de detalle. Diferir: cargar los destinos **cuando el usuario abre el picker** (server action bajo demanda) en lugar de eager.

### 5.5 — Otros
- **`library`: `page` sin cota superior** — `?page=999999` da offset enorme y lista vacía con "página 999999 / N"; clamp a `totalPages`.
- **`<img>` en todas las rutas**: es un **trade-off consciente** (los covers/mosaicos y avatares vienen de múltiples hosts de Spotify CDN + lookaside; `next/image` exigiría muchos `remotePatterns` con poco beneficio en miniaturas ya optimizadas). Los contenedores `aspect-square` controlan el CLS y hay `loading="lazy"`. ✅ Aceptable; opcional añadir `width`/`height` explícitos.

## 🎨 Código Limpio y Buenas Prácticas
- **`/debug` — ID de playlist hardcodeado** (`debug/page.tsx:21-23`): `3A2QgeFb2DTynA42GNuhMf` (dato personal del autor). Para otro usuario esas sondas dan 404/403. Además `/debug` **no comprueba sesión ni redirige** (a diferencia del resto de rutas) y no está gated a dev. Recomendado: aceptar el ID por query, exigir sesión y limitar a `NODE_ENV === "development"` (o excluir del build).
- **Patrón `let playlistError` + `.catch` mutable** (`playlist/[id]/page.tsx:26-46`): funciona pero es torpe; un helper `settle(promise) → {data, error}` lee mejor. Casts redundantes (`tracksError as {status?}`).
- **Filtros de `page.tsx`**: "collab" incluye colaborativas propias y seguidas, con lo que las categorías se solapan y no suman `total`. Es esperado (son vistas), pero conviene documentarlo.

## 🚀 Propuestas de Mejora
1. **Sanitizar** las descripciones (5.1) + **CSP** (enlaza con Bloque 1).
2. **Rate-limit UX robusta** que sobreviva a producción (5.2).
3. **Verificar `items` vs `tracks`.total** y soportar ambos (5.3).
4. **Lazy-load de destinos del picker** en la página de detalle (5.4).
5. **Gate + parametrizar `/debug`** (o excluirlo de producción).
6. Clamp de paginación en `library`.

## ✅ Verificado (NO son bugs)
- **`await params` / `await searchParams`** correctamente usados en todas las rutas → convención async de props de Next 16 bien aplicada.
- **Validación de entrada**: `searchParams.f` contra whitelist; `page` con `Math.max(1, parseInt || 1)`.
- **`getMe()` cacheado 600s** → no se re-descarga en cada navegación.
- **`error.tsx`** correctamente `"use client"` con `reset()`.
- Las páginas `tags`/`smart`/`stats`/`library` **sí** verifican sesión (`if (!session) redirect("/")`) — la brecha de auth del Bloque 4.1 es a nivel de *action*, no de estas rutas.

## Resumen Bloque 5
| Severidad | Hallazgo |
|---|---|
| 🟠 Media | `dangerouslySetInnerHTML` con descripciones de terceros → XSS (sin CSP) |
| 🟠 Media | UX de rate-limit de `error.tsx` inoperante en producción (mensaje redactado) |
| 🟠 Media | `p.items?.total` puede degradar a 0 en todo el índice (verificar `items` vs `tracks`) |
| 🟠 Media | `playlist/[id]` pagina todas las playlists en cada carga (picker eager) |
| 🟡 Baja | `/debug` con ID hardcodeado, sin auth ni gate dev; paginación sin clamp; patrón `let error` |

---

# BLOQUE 6 — Componentes Cliente / UI & Estado

**Archivos:** `PlaylistTracksTable.tsx` (~1200 líneas) · `StatsScanner.tsx` · `SmartPlaylistsManager.tsx` · `TagsManager.tsx` · `TagPicker.tsx` · `TagBadge.tsx` · `TopBar.tsx` · `CreatePlaylistDialog.tsx` · `MergePlaylistsDialog.tsx`

## 🔍 Errores y Bugs Críticos

### 6.1 — `setState` dentro de `useMemo` → efecto secundario en render (`MergePlaylistsDialog.tsx:104-113`) — 🟠 Media
```tsx
useMemo(() => {
  if (selected.size >= 2 && !name) setName(names.join(" + "));
}, [selected]);
```
`useMemo` debe ser **puro**; se ejecuta durante el render. Llamar `setName` ahí es un anti-patrón que en React 19 (Strict/concurrent) puede doble-invocarse o comportarse de forma inesperada, y dispara un re-render en cadena. Debe ser `useEffect`.
```tsx
useEffect(() => {
  if (selected.size >= 2 && !name) {
    const names = playlists.filter((p) => selected.has(p.id)).map((p) => p.name).slice(0, 3);
    setName(names.join(" + "));
  }
}, [selected, name, playlists]);
```

### 6.2 — Fechas de smart playlist como texto libre → typo rompe la regla en silencio (`SmartPlaylistsManager.tsx:410-425`) — 🟠 Media
`addedAfter`/`addedBefore` son `<input>` de texto libre ("YYYY-MM-DD"). Un typo hace que `smart-rules.parseDate` → `Date.parse` = `NaN` → `0`. Efecto perverso: `addedBefore` con fecha inválida evalúa `parseDate(t) >= 0` = **siempre true → excluye todas las canciones**, sin aviso. Usar `<input type="date">` (garantiza formato) y/o validar antes de guardar.

## ⚡ Optimización y Rendimiento

### 6.3 — `visibleEntries` / `visibleUris` sin memoizar (`PlaylistTracksTable.tsx:366-412`) — 🟠 Media
El resto de derivados (`dupAnalysis`, `tagFilterChips`, `artistInputs`, `genreCounts`, `filteredGenreCounts`, `allUris`) **sí** están memoizados, pero el filtrado principal `visibleEntries` (`.map().filter()` sobre todos los tracks) se recalcula en **cada render** — incluida cada pulsación en el buscador de género o cualquier cambio de estado. Con miles de tracks cargados es O(n) por render. Envolver en `useMemo` con deps `[tracks, showOnlyDups, selectedGenres, genreData, selectedTagIds, tagsByUri]`.

### 6.4 — Selección persiste al cambiar filtros → operaciones sobre items ocultos (`PlaylistTracksTable`) — 🟡 Baja
`selected` no se limpia cuando cambian los filtros. Puedes "Seleccionar todo", filtrar, y `handleRemove`/`handlePick` operan sobre **todos** los seleccionados (incluidos los ya no visibles) vía `Array.from(selected)`. Sorprendente para el usuario. Considerar limpiar selección al cambiar filtros, o intersecar con `visibleUris`.

### 6.5 — Keys `id-index` remontan filas en reorder/filtro (`PlaylistTracksTable:587`) — 🟡 Baja
`key={\`${t?.id ?? "local"}-${index}\`}` incluye el índice visible → tras un reorder o cambio de filtro, cada fila recibe una key nueva y React **remonta** las filas (pierde estado local, rompe continuidad de animación). Para duplicados (misma uri) usar una key estable por ocurrencia, p. ej. `${uri}#${originalIndex}`.

## 🎨 Código Limpio y Buenas Prácticas

### 6.6 — `PlaylistTracksTable` viola SRP (≈20 `useState`, ~1200 líneas) — 🟠 Media
Un solo componente concentra: selección múltiple, lazy-load paginado, tags (estado + picker), análisis de géneros (progreso + filtro), drag-and-drop, detección/limpieza de duplicados y dos diálogos. Es el archivo más frágil del proyecto. Propuesta: extraer hooks (`useTrackSelection`, `useLazyTracks`, `useGenreAnalysis`, `useDragReorder`) y subcomponentes (`GenreFilter` ya está separado; separar `TagFilterBar`, `BulkActionBar`, `DuplicatesBar`), o migrar el estado a `useReducer`.

### 6.7 — Otros
- **`confirm()` / `alert()` nativos** (remove, cleanup, wipeCache, delete de tags/smart): bloqueantes, no estilizables, rompen la estética editorial. Sustituir por un modal de confirmación propio.
- **`TagBadge.tsx`**: `const Tag = onClick ? "button" : "span"` **shadowea** el tipo importado `Tag` — confuso; renombrar la variable local (`El`, `Comp`).
- **`TagsManager` doble-invoke de `handleRename`** (`onBlur` + `onKeyDown` Enter): al pulsar Enter puede dispararse dos veces (inofensivo por el guard, pero redundante).

## 🚀 Propuestas de Mejora

### 6.8 — Accesibilidad de modales (transversal a los 4 diálogos) — 🟠 Media
`CreatePlaylistDialog`, `MergePlaylistsDialog`, `PlaylistPicker`, `TagPicker` comparten carencias:
- **Sin handler de tecla Escape** pese a que `PlaylistPicker` muestra "Cancelar (esc)" → **afordancia falsa** (verificado: solo `TagsManager` maneja Escape, y en sus inputs inline).
- Sin `role="dialog"` + `aria-modal="true"` + `aria-labelledby`.
- Sin **focus trap** ni restauración de foco al cerrar.
- Sin bloqueo de scroll del `body`.
- El **drag-and-drop no tiene alternativa de teclado**.

Propuesta: un componente `<Modal>` reutilizable que centralice Escape, focus trap, `aria-*` y scroll-lock; y botones ↑/↓ como alternativa accesible al DnD.

## 💻 Código Refactorizado (fragmentos clave)

**`PlaylistTracksTable.tsx` — memoizar el filtrado:**
```tsx
const visibleEntries = useMemo(() =>
  tracks.map((item, i) => ({ item, index: i + 1 })).filter(({ item }) => {
    const t = trackOf(item);
    if (!t) return false;
    if (showOnlyDups && !dupAnalysis.dupUris.has(t.uri)) return false;
    if (selectedGenres.size > 0 && genreData) {
      const g = new Set(t.artists.flatMap((a) => genreData[a.id] ?? []));
      if (![...selectedGenres].some((x) => g.has(x))) return false;
    }
    if (selectedTagIds.size > 0) {
      const ids = new Set((tagsByUri[t.uri] ?? []).map((x) => x.id));
      if (![...selectedTagIds].some((id) => ids.has(id))) return false;
    }
    return true;
  }),
  [tracks, showOnlyDups, dupAnalysis, selectedGenres, genreData, selectedTagIds, tagsByUri],
);
```

**Hook de Escape reutilizable para modales:**
```tsx
function useModalKeys(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // scroll-lock
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);
}
```

## ✅ Verificado (NO son bugs)
- **Reorder DnD correcto**: se deshabilita con filtros activos (`reorderEnabled = ownedByMe && !filtersActive`) y `visibleEntries` preserva el **índice original** → las posiciones enviadas a Spotify son correctas. Optimista con rollback en error.
- **Sin cargas concurrentes**: los botones "Cargar" están `disabled={loadingMore || loadingAll}`.
- **`StatsScanner` es sólido**: `useEffect` con guard `cancelled`, `cancelRef` para abortar, persistencia en try/catch, `computeStats` memoizado.
- La mayoría de derivados pesados **sí** están memoizados (ver 6.3, la excepción).

## Resumen Bloque 6
| Severidad | Hallazgo |
|---|---|
| 🟠 Media | `setState` en `useMemo` (MergePlaylistsDialog) → efecto en render |
| 🟠 Media | Fechas de smart playlist como texto libre → typo excluye todo en silencio |
| 🟠 Media | `visibleEntries` sin memoizar → recomputo O(n) por render |
| 🟠 Media | `PlaylistTracksTable` viola SRP (~20 useState, ~1200 líneas) |
| 🟠 Media | A11y de modales: sin Escape (afordancia falsa), sin `role`/focus trap/scroll-lock |
| 🟡 Baja | Selección persiste al filtrar; keys `id-index` remontan filas; `confirm` nativo; shadowing en TagBadge |

---

# 🧾 RESUMEN EJECUTIVO — Priorización Global

Auditoría completa (6 bloques). Hallazgos consolidados y ordenados por prioridad de acción.

## P0 — Corregir cuanto antes (corrección / seguridad / pérdida de datos)
| ID | Hallazgo | Archivo |
|---|---|---|
| 4.1 | Server actions de DB local sin `auth()` (tag/smart/liked/genre) | `tag-actions`, `liked-cache`, `genre-actions`, `smart-actions` |
| 4.2 | `materialize` no persiste el ID tras crear → playlists huérfanas + duplicación | `smart-actions.ts:200` |
| 3.1 | Reintento de POST sobre 5xx → duplicación de tracks/playlists | `spotify.ts:30` |
| 4.3 | `setTagsForTrack` sin transacción → pérdida de tags | `tag-actions.ts:141` |
| 1.1 | Monkeypatch de `fetch` sin idempotencia → acumula wrappers en HMR | `auth.ts:9` |
| 1.2 | Refresh propaga `accessToken` caduco; carrera de refresh_token | `auth.ts:90` |
| 2.1 | Fuga de conexiones SQLite en HMR (sin singleton) | `db/index.ts:13` |
| 2.2 | Sin migraciones → drift de esquema; doble fuente de verdad | `db/index.ts`, `schema.ts` |

## P1 — Alta prioridad (robustez, XSS, rendimiento visible)
| ID | Hallazgo |
|---|---|
| 5.1 | XSS: descripciones de terceros con `dangerouslySetInnerHTML` sin sanitizar (sin CSP) |
| 5.3 | `p.items?.total` puede mostrar 0 en todo el índice (**verificar `items` vs `tracks` en /debug**) |
| 5.2 | UX de rate-limit inoperante en producción (mensaje redactado) |
| 3.2 | `Retry-After` no numérico → backoff `NaN` → reintento inmediato |
| 3.3 / 3.4 | Last.fm: `tags.tag` no-array pierde género; sin limitador + 6 workers → 429 tragado |
| 4.5 | `getArtistGenres` re-fetch infinito de artistas sin género |
| 6.1 | `setState` en `useMemo` (MergePlaylistsDialog) |
| 6.3 | `visibleEntries` sin memoizar en el componente más caliente |
| 5.4 | `playlist/[id]` pagina todas las playlists en cada carga |
| 1.3 | Fraunces sin variante itálica (`style` ausente) |

## P2 — Calidad, mantenibilidad, a11y (deuda técnica)
| ID | Hallazgo |
|---|---|
| 6.6 | `PlaylistTracksTable` viola SRP (~20 useState) → extraer hooks/subcomponentes |
| 6.8 | A11y de modales (Escape falso, sin `role`/focus trap/scroll-lock) |
| 6.2 | Fechas de smart playlist como texto libre → `<input type="date">` |
| 4.4 / 4.6 | DELETE inconsistente en `cleanupDuplicates`; `inArray` sin chunk en tag-actions |
| 4.7 | Validación de tags inconsistente (`renameTag` sin checks); TOCTOU en `createTag` |
| 5.5 | `/debug` con ID hardcodeado, sin auth ni gate dev |
| 1.x | Sin PKCE; sin validación de env; `.font-serif/.mono` duplicados; a11y `prefers-reduced-motion` |
| 3.5 | `TokenBucket` mal nombrado; sin timeouts; `SpotifyError` no centralizado |
| 6.7 | `confirm()`/`alert()` nativos; shadowing en TagBadge |

## Quick wins (bajo esfuerzo, buen retorno)
1. `requireSession()` compartido en las actions de DB (4.1).
2. Persistir `spotifyPlaylistId` justo tras crear en `materialize` (4.2).
3. `Number.isFinite` en el parseo de `Retry-After` (3.2).
4. `style: ["normal","italic"]` en Fraunces (1.3).
5. `useEffect` en lugar de `useMemo` en MergePlaylistsDialog (6.1).
6. Singleton de `db` en `globalThis` (2.1).
7. `@media (prefers-reduced-motion)` en `globals.css`.

## Fortalezas del proyecto (lo que está bien hecho)
- `smart-rules.ts`: lógica pura, correcta y testeable.
- Rate limiter global bien conceptualizado (aunque mal nombrado) y singleton correcto.
- Convención async de Next 16 (`await params`) y `proxy.ts` bien aplicadas.
- Caché local-first coherente (SQLite + revalidateTag) y lazy-loading pensado para el rate limit.
- Manejo de los cambios de la API de Spotify (Feb 2026) documentado y mayormente cubierto.
- Estética y sistema editorial muy cuidados.

---

---

# ✅ CORRECCIONES APLICADAS — Pasada P0 (2026-07-02)

Aplicadas en el working tree (sin commit). **Pendiente de compilar/probar** (`node_modules` estaba vacío al aplicarlas).

| ID | Cambio | Archivos |
|---|---|---|
| 4.1 | `requireSession()` compartido al inicio de las 19 server actions de DB | **nuevo** `lib/require-session.ts`; `tag-actions.ts` (9), `smart-actions.ts` (6), `liked-cache.ts` (3), `genre-actions.ts` (1) |
| 4.2 | `materialize` persiste `spotifyPlaylistId` justo tras crear (evita huérfanas) | `smart-actions.ts` |
| 4.3 | `setTagsForTrack` ahora usa `db.transaction()` (delete+insert atómico) | `tag-actions.ts` |
| 3.1 | Reintento de 5xx solo para métodos idempotentes (POST ya no se reintenta) | `spotify.ts` |
| 3.2 | `Retry-After` no numérico → `Number.isFinite` evita backoff `NaN` | `spotify.ts` |
| 1.1 | Patch de `globalThis.fetch` con guarda de idempotencia + tipado | `auth.ts` |
| 1.2 | Refresh fallido limpia `accessToken` (no propaga token caduco) | `auth.ts` |
| 2.1 | Singleton de `db` en `globalThis` + `busy_timeout=5000` | `db/index.ts` |
| 1.3 | Fraunces con `style: ["normal","italic"]` (itálica real) | `layout.tsx` |
| 6.1 | `useMemo` con `setState` → `useEffect` | `MergePlaylistsDialog.tsx` |

**Verificación estática hecha:** imports correctos, 19 guards contados, sin `useMemo` con efecto, regiones bien formadas.

## Pasada P1 — Endurecimiento de integración externa (2026-07-02)

| ID | Cambio | Archivos |
|---|---|---|
| 3.4 | `lastfmLimiter` dedicado (~4.5 req/s); Last.fm ahora pasa por él antes de cada fetch | `rate-limiter.ts`, `lastfm.ts` |
| 3.5 | `TokenBucket` → `IntervalThrottle` (nombre correcto) + comentario "bursts" arreglado | `rate-limiter.ts` |
| 3.5 | Timeout de 8 s (`AbortSignal.timeout`) en el fetch de Last.fm | `lastfm.ts` |
| 3.3 | Normalización de `tags.tag` (array u objeto) para que `.slice` no lance | `lastfm.ts` |
| 4.5 | Géneros vacíos cacheados con TTL de reintento de 7 días (no re-fetch infinito) + comentario PARALLELISM corregido | `genre-actions.ts` |
| 2.3 | `JSON.parse` defensivo (`safeParse*`) en lectura de caché | `genre-actions.ts`, `liked-cache.ts` |
| 4.6 | `inArray` chunkeado a 500 en `getTagsForTracks` y `removeTagFromTracks` | `tag-actions.ts` |

**Verificación estática:** sin referencias a `TokenBucket`, `lastfmLimiter` cableado, todos los `JSON.parse` restantes bajo `try/catch`.

**Verificación pendiente (correr localmente):**
```bash
npm install
npx tsc --noEmit      # comprobar tipos (esp. db.transaction sync + .run())
npm run lint
npm run build
```

## Pasada final — P1/P2 restantes sin dependencias (2026-07-02)

| ID | Cambio | Archivos |
|---|---|---|
| 5.1 | XSS: `sanitizeDescription()` (quita etiquetas + decodifica entidades → texto plano); reemplaza los dos `dangerouslySetInnerHTML` | **nuevo** `lib/sanitize.ts`; `page.tsx`, `playlist/[id]/page.tsx` |
| 5.3 | `playlistTrackTotal()` tolerante a `items`/`tracks` → el índice ya no mostraría 0 si Spotify devuelve `tracks`; `items` pasa a opcional | `spotify.ts` + `page.tsx`, `MergePlaylistsDialog.tsx`, `PlaylistTracksTable.tsx` |
| 2.2 | Tooling de migraciones: `drizzle.config.ts` + scripts `db:generate/migrate/push/studio` (auto-create se mantiene como red de seguridad) | **nuevo** `drizzle.config.ts`, `package.json` |
| 6.3 | `visibleEntries` y `visibleUris` memoizados (`useMemo`) en el componente más caliente | `PlaylistTracksTable.tsx` |
| 4.7 | `renameTag` ahora valida longitud y unicidad (excluyendo self, vía `ne`) | `tag-actions.ts` |
| 5.2 | `error.tsx`: copia que menciona el límite temporal de Spotify (mitiga la redacción de mensajes en prod) | `error.tsx` |
| 1.x | `@media (prefers-reduced-motion)` desactiva marquee/rise/fade | `globals.css` |

**Verificación estática:** cero `dangerouslySetInnerHTML` en JSX, cero `items?.total`/`tracks?.total` sueltos, `playlistTrackTotal`/`sanitizeDescription` cableados, memoización bien cerrada.

**NO aplicado a propósito (riesgo sin poder probar login/arranque):**
- **PKCE** (`checks: ["pkce","state"]`) — cambia el flujo OAuth; probar login antes.
- **Validación de env con throw** — cambia el modo de fallo en arranque.
- Quitar `.font-serif/.mono` duplicados de `globals.css` — podría romper estilos si la auto-generación de Tailwind v4 no aplica.
- **5.4** (lazy-load del picker), **6.6/6.8** (refactor SRP + `<Modal>` accesible), **cleanupDuplicates** DELETE al body (4.4) — refactors mayores para una sesión dedicada.

**Verificación pendiente (correr localmente):**
```bash
npm install
npx tsc --noEmit      # punto de riesgo: db.transaction sync + .run() en setTagsForTrack
npm run lint && npm run build
npm run db:generate   # (opcional) empezar a versionar el esquema
```

---

*Auditoría completada — 6/6 bloques. Correcciones P0 + P1 + P2-seguras aplicadas. Documento vivo; quedan solo refactors mayores y los 2 cambios de auth que requieren probar login.*
