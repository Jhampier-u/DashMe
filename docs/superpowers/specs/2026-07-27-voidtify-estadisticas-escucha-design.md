# Voidtify — Estadísticas de escucha

**Fecha:** 2026-07-27
**Estado:** diseño aprobado, pendiente de plan de implementación
**Ámbito:** uso personal, un solo usuario

---

## 1. Objetivo

Convertir Voidtify en un "stats.fm personal": historial de escucha completo y permanente, con tops por cualquier rango de fechas, fichas por artista/canción/álbum, estadísticas temporales y tarjetas para compartir.

Hoy el proyecto es **Ledger**, un organizador editorial de la biblioteca de Spotify (playlists, tags, duplicados, smart playlists). Ese trabajo no se tira: pasa a ser una sección más dentro de una app cuyo centro son ahora las estadísticas de escucha.

## 2. Contexto de partida

Lo que ya existe y se reutiliza:

| Pieza | Ubicación | Uso |
|---|---|---|
| OAuth con Spotify (Auth.js v5) | `src/auth.ts` | Scopes `user-top-read` y `user-read-recently-played` **ya concedidos** |
| Rate limiter global + backoff 429/5xx | `src/lib/spotify.ts`, `src/lib/rate-limiter.ts` | Se extrae su núcleo para reutilizarlo sin sesión |
| SQLite + Drizzle, auto-create idempotente | `src/db/index.ts` | Se añaden tablas al mismo bloque `CREATE TABLE IF NOT EXISTS` |
| Cliente Last.fm | `src/lib/lastfm.ts` | Única fuente de géneros viable |
| Caché de artistas con TTL 30 días | tabla `artists` | Destino de los géneros resueltos |
| Crear/materializar playlists | `src/lib/smart-actions.ts` | Base de "playlist desde tus tops" |
| Guard de Server Actions | `src/lib/require-session.ts` | Patrón obligatorio para toda action nueva |

Restricciones del entorno:

- El fork de la Web API (feb 2026) eliminó `GET /artists?ids=` en bloque y dejó `genres` casi siempre vacío. Los géneros vienen de Last.fm.
- La app corre en Development Mode. Suficiente para la cuenta propia.
- **El dump GDPR aún no está pedido.** El *Extended Streaming History* tarda entre 1 y 4 semanas. El *Account data* (básico) llega en ~5 días.
- Destino futuro: un VPS. Todo lo que se diseñe debe funcionar igual en local y en servidor.

## 3. Alcance

**Dentro:**

1. Tops de canciones, artistas, álbumes y géneros en cualquier rango.
2. Minutos totales y número de reproducciones por periodo.
3. Ficha por artista/canción/álbum: veces escuchado, primera vez, última vez, posición en el ranking propio.
4. Importación del *Extended Streaming History* (y del básico).
5. Historial completo con búsqueda y filtro por fechas.
6. Rangos personalizados arbitrarios.
7. Horas por día/mes/año, evolución, skips, hora del día, rachas.
8. Tarjetas PNG para compartir.
9. Playlists generadas desde los tops.
10. Captura continua de escuchas vía cron, para no perder lo que suene desde hoy.

**Fuera:**

- Comparación con otros usuarios o rankings globales (hay un solo usuario).
- Perfil público compartible.
- Estadísticas de podcasts.
- Multiusuario.

---

## 4. Decisiones de diseño

### D1 — Tabla única de streams como fuente de verdad

Una sola tabla `streams` alimentada por dos fuentes (`live` = captura vía API, `import` = dump), marcadas con una columna `source`. Todas las estadísticas son consultas SQL sobre esa tabla.

*Alternativas descartadas:* dos tablas separadas con vista unificada (obliga a `UNION` y dedup en cada consulta); construir primero solo sobre la API (callejón sin salida: de los tops de la API no se puede derivar minutos, reproducciones, primera/última vez ni rachas).

### D2 — El dump manda en su propio rango

Al terminar una tanda de importación se calcula el rango cerrado `[min(ts), max(ts)]` de lo importado y se ejecuta:

```sql
DELETE FROM streams WHERE source = 'live' AND ts BETWEEN :min AND :max
```

Las filas `live` de ese periodo desaparecen; las posteriores al dump sobreviven. Elimina el problema de deduplicar entre fuentes por decreto, en lugar de resolverlo con heurísticas de coincidencia difusa.

El borrado ocurre **al final de la tanda completa**, no por archivo: si el import falla a medias, no se pierden a la vez lo capturado y lo importado.

### D3 — Los tops de la API no son escuchas

`/me/top/*` devuelve un ranking precalculado por Spotify con criterios no publicados. Vive en su propia tabla `top_snapshots` y nunca entra en `streams`. Se muestra como contraste ("lo que Spotify cree que escuchas"), no como dato agregable.

### D4 — Zona horaria precalculada al insertar

`ts` se guarda en UTC (epoch ms). Además se calculan y almacenan `local_date` (`YYYY-MM-DD`) y `local_hour` (0–23) usando `STATS_TZ`.

Motivo: los histogramas por hora y por día son consultas frecuentes; calcular la conversión al vuelo impide usar índices. Además el VPS correrá casi seguro en UTC, así que depender de la hora local del proceso daría resultados distintos en cada máquina.

Coste: cambiar `STATS_TZ` obliga a recalcular. Se expone una acción "Recalcular zona horaria" en `/ajustes`.

### D5 — Credenciales persistidas en la base de datos

El cron no tiene cookie de sesión. El refresh token se guarda en `spotify_credentials` durante el login por navegador, y un cliente HTTP sin sesión lo usa para obtener access tokens. Es además exactamente lo que hará falta en el VPS.

### D6 — El rango vive en la URL

`?preset=6m` o `?desde=2019-03-01&hasta=2019-07-31`. Los Server Components lo leen de `searchParams` sin estado de cliente, las vistas son marcables como favoritas y el botón atrás funciona.

Consecuencia: los "rangos personalizados" no son una función aparte, son el caso general.

### D7 — El dump entra desde el disco, no por upload

Los archivos se colocan en `data/import/`. Evita el límite de body de las Server Actions (1 MB frente a archivos de 5–30 MB), elimina el código de multipart y aprovecha que `data/` ya está en `.gitignore`.

### D8 — Sin tablas de agregación precalculada

Con ~300 000 filas e índices adecuados, SQLite resuelve estas agregaciones en milisegundos. No se construyen rollups ni vistas materializadas hasta que exista un problema medido.

---

## 5. Modelo de datos

Todas las tablas se añaden al bloque `CREATE TABLE IF NOT EXISTS` de `src/db/index.ts` y al esquema Drizzle de `src/db/schema.ts`, siguiendo el patrón existente.

### 5.1 `streams`

```sql
CREATE TABLE IF NOT EXISTS streams (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ts            INTEGER NOT NULL,      -- epoch ms UTC, fin de la reproducción
  ms_played     INTEGER NOT NULL,
  track_uri     TEXT,                  -- NULL en locales y en el dump básico
  track_name    TEXT NOT NULL,
  artist_name   TEXT NOT NULL,
  album_name    TEXT,
  track_key     TEXT NOT NULL,         -- normalizado: artista + título
  artist_key    TEXT NOT NULL,         -- normalizado
  album_key     TEXT,                  -- normalizado
  local_date    TEXT NOT NULL,         -- 'YYYY-MM-DD' en STATS_TZ
  local_hour    INTEGER NOT NULL,      -- 0-23 en STATS_TZ
  reason_start  TEXT,
  reason_end    TEXT,
  shuffle       INTEGER,
  skipped       INTEGER,
  platform      TEXT,
  source        TEXT NOT NULL,         -- 'live' | 'import'
  dedup_key     TEXT NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS streams_ts_idx         ON streams(ts);
CREATE INDEX IF NOT EXISTS streams_artist_idx     ON streams(artist_key, ts);
CREATE INDEX IF NOT EXISTS streams_track_idx      ON streams(track_key, ts);
CREATE INDEX IF NOT EXISTS streams_album_idx      ON streams(album_key, ts);
CREATE INDEX IF NOT EXISTS streams_local_date_idx ON streams(local_date);
CREATE INDEX IF NOT EXISTS streams_local_hour_idx ON streams(local_hour);
CREATE INDEX IF NOT EXISTS streams_source_ts_idx  ON streams(source, ts);
```

**Normalización de claves** (`src/lib/stats/normalize.ts`, función pura):

1. `String(x)`, `trim()`
2. `toLowerCase()`
3. `normalize("NFD")` y eliminación de marcas diacríticas (`\p{M}`)
4. Colapso de espacios en blanco a un espacio único

`artist_key` = normalizar(artista). `track_key` = `artist_key + "␟" + normalizar(título)`. `album_key` = `artist_key + "␟" + normalizar(álbum)`.

Se usa un separador no imprimible para que un título que contenga el separador no genere colisiones.

**`dedup_key`** = `${ts}:${track_uri ?? track_key}`. Con `UNIQUE` y `INSERT OR IGNORE`, reimportar un archivo es idempotente. Dos reproducciones distintas del mismo track terminando en el mismo milisegundo son imposibles en la práctica.

**`ms_played` en filas `live`:** `recently-played` no informa de la duración reproducida. Se guarda la duración completa del track (`duration_ms`), que es una sobreestimación acotada — Spotify solo lista lo que superó ~30 s. Es temporal: el dump reemplaza ese rango con datos exactos (D2).

**`skipped`, `reason_start`, `reason_end` en filas `live`:** `NULL`. Las estadísticas de skips se calculan **solo sobre `source = 'import'`** y la UI indica desde qué fecha hay datos fiables.

### 5.2 `spotify_credentials`

```sql
CREATE TABLE IF NOT EXISTS spotify_credentials (
  id               INTEGER PRIMARY KEY CHECK (id = 1),
  spotify_user_id  TEXT NOT NULL,
  refresh_token    TEXT NOT NULL,
  access_token     TEXT,
  expires_at       INTEGER,
  updated_at       INTEGER NOT NULL
);
```

Fila única. `CHECK (id = 1)` impide por esquema que existan varias.

### 5.3 `capture_state`

```sql
CREATE TABLE IF NOT EXISTS capture_state (
  id               INTEGER PRIMARY KEY CHECK (id = 1),
  last_played_at   INTEGER,   -- cursor para el parámetro `after`
  last_run_at      INTEGER,
  last_run_status  TEXT,      -- 'ok' | 'error' | 'gap'
  last_run_inserted INTEGER,
  last_error       TEXT,
  gap_suspected_at INTEGER
);
```

### 5.4 `import_batches`

```sql
CREATE TABLE IF NOT EXISTS import_batches (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  filename      TEXT NOT NULL,
  file_hash     TEXT,
  format        TEXT,        -- 'extended' | 'basic'
  rows_read     INTEGER,
  rows_inserted INTEGER,
  rows_skipped  INTEGER,     -- podcasts, vídeo
  rows_invalid  INTEGER,
  range_start   INTEGER,
  range_end     INTEGER,
  imported_at   INTEGER NOT NULL,
  status        TEXT         -- 'ok' | 'error'
);
```

### 5.5 `artist_resolution`

```sql
CREATE TABLE IF NOT EXISTS artist_resolution (
  artist_key        TEXT PRIMARY KEY,
  spotify_artist_id TEXT,
  image_url         TEXT,
  resolved_at       INTEGER,
  attempts          INTEGER NOT NULL DEFAULT 0
);
```

Puente entre los **nombres** del dump y los **IDs** de Spotify, que el dump no incluye. Flujo: `artist_key → spotify_artist_id → artists.genres` (la tabla existente, alimentada por Last.fm).

Se resuelve de forma perezosa y solo para los artistas mostrados en pantalla. `attempts` evita reintentar indefinidamente artistas irresolubles.

### 5.6 `top_snapshots`

```sql
CREATE TABLE IF NOT EXISTS top_snapshots (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  taken_at     INTEGER NOT NULL,
  time_range   TEXT NOT NULL,   -- 'short_term' | 'medium_term' | 'long_term'
  entity       TEXT NOT NULL,   -- 'artists' | 'tracks'
  payload_json TEXT NOT NULL
);
```

---

## 6. Componentes

### 6.1 Cliente HTTP sin sesión

**Refactor de `src/lib/spotify.ts`.** El núcleo actual —rate limiter, backoff, reintento selectivo de 5xx solo en métodos idempotentes, tope de espera de 60 s— se extrae a una función que recibe el access token como argumento. Encima quedan dos envoltorios:

- `spotifyFetch(path, init)` — token desde la sesión. **La firma pública no cambia**; ningún consumidor actual se toca.
- `spotifyFetchHeadless(path, init)` — token desde `spotify_credentials`, refrescándolo y persistiéndolo si ha caducado.

Sin duplicar la lógica de reintentos.

**Siembra de credenciales.** En el callback `jwt` de `src/auth.ts`, cuando llega `account` (primer login), se escribe el refresh token en `spotify_credentials` mediante `await import("@/db")` **dinámico**, para no arrastrar `better-sqlite3` a bundles que no sean Node. Verificado que `src/proxy.ts` no importa `auth`, así que no hay riesgo de runtime edge.

Si el refresh falla con `invalid_grant` (token revocado), se marca el estado y `/ajustes` pide volver a entrar.

### 6.2 Captura continua

**Endpoint:** `POST /api/cron/capture`, protegido por la cabecera `x-cron-secret` comparada con `CRON_SECRET` usando `timingSafeEqual`. Sin secreto válido: 401 sin efectos.

**Lógica por ejecución:**

1. Leer `capture_state.last_played_at`.
2. `GET /me/player/recently-played?limit=50` (con `after` si hay cursor).
3. Convertir cada item a fila `streams` con `source = 'live'`.
4. `INSERT OR IGNORE` por lote.
5. Avanzar el cursor al `played_at` máximo.
6. Registrar el resultado en `capture_state`.

**Detección de huecos:** si Spotify devuelve 50 items y **todos** resultan nuevos, es probable que se hayan perdido escuchas intermedias. Se anota `last_run_status = 'gap'` y `gap_suspected_at`, visible en `/ajustes`. No se oculta.

**Concurrencia:** `busy_timeout = 5000` ya está configurado. Además, si `last_run_at` es de hace menos de 30 segundos, la ejecución se descarta como duplicada. El botón "ejecutar ahora" de `/ajustes` salta esa comprobación: es una acción deliberada del usuario y debe responder siempre.

**Snapshot de los tops de la API:** la misma ejecución del cron comprueba si ha pasado más de un día desde el último `top_snapshots.taken_at`. Si es así, pide los seis tops (`artists` y `tracks` × tres `time_range`) y los guarda. Son 6 llamadas diarias. Se hace aquí y no en un cron aparte para no tener dos tareas programadas que mantener.

**Frecuencia:** 20 minutos. La ventana de `recently-played` son 50 tracks (≈ 2,5–3 h de escucha continua), lo que deja margen amplio. ~72 llamadas diarias, irrelevante frente al límite.

**Disparo local (Windows, Task Scheduler):**

```bash
curl -X POST -H "x-cron-secret: $CRON_SECRET" http://127.0.0.1:3000/api/cron/capture
```

**Disparo en VPS (`crontab -e`):**

```bash
*/20 * * * * curl -sX POST -H "x-cron-secret: SECRETO" http://127.0.0.1:3000/api/cron/capture
```

Misma ruta y mismo código en ambos entornos.

### 6.3 Importador

**Entrada:** archivos en `data/import/`.

**Detección de formato** por las claves presentes:

| Campo | Extended | Básico |
|---|---|---|
| Fecha | `ts` | `endTime` |
| Duración | `ms_played` | `msPlayed` |
| Canción | `master_metadata_track_name` | `trackName` |
| Artista | `master_metadata_album_artist_name` | `artistName` |
| Álbum | `master_metadata_album_album_name` | — |
| URI | `spotify_track_uri` | — |
| `skipped`, `shuffle`, `reason_*`, `platform` | sí | — |

Soportar el formato básico permite validar todo el pipeline con datos reales ~3 semanas antes de que llegue el extended.

**Reglas de procesado:**

- **Formato extended:** se descartan las filas sin `master_metadata_track_name` (podcasts y vídeo) y se cuentan en `rows_skipped`.
- **Formato básico:** no contiene podcasts —Spotify los entrega en un archivo aparte que no importamos—, así que `rows_skipped` será siempre 0. No hay campo con el que distinguirlos, y no hace falta.
- **Se guardan todas las reproducciones, incluidas las de pocos segundos.** El umbral de "reproducción contada" (`ms_played >= 30000`) se aplica al consultar, no al importar; filtrar antes haría imposible el análisis de skips.
- Una entrada malformada incrementa `rows_invalid` y no interrumpe el archivo.

**Rendimiento:** una transacción por archivo, sentencia preparada, lotes de ~500 filas, `INSERT OR IGNORE`. **Sin `.returning()`** — es la trampa presente hoy en `saveLikedTracks` (`src/lib/liked-cache.ts:92`), que pide a SQLite devolver filas que nadie lee.

**Progreso:** el cliente procesa **un archivo por llamada** en bucle, mostrando avance. Evita una petición única de varios minutos y localiza el fallo en un archivo concreto.

**Cierre de tanda:** aplicar D2 (borrado del rango en filas `live`).

**Reimportación:** segura por `dedup_key UNIQUE`. Además `file_hash` permite avisar de que un archivo ya se importó y cuándo.

**Seguridad:** la Server Action acepta **solo un nombre de archivo** de la lista previamente enumerada por el servidor, nunca una ruta. Se valida contra la lista real del directorio antes de abrir nada. Sin esto sería un directory traversal.

El importador no hace ninguna llamada a Spotify.

### 6.4 Capa de estadísticas

Módulos en `src/lib/stats/`, cada uno con un propósito y testeable de forma aislada:

| Módulo | Responsabilidad |
|---|---|
| `range.ts` | Presets y resolución a `{from, to, label}` |
| `normalize.ts` | Normalización de claves (pura) |
| `tops.ts` | Top canciones, artistas, álbumes |
| `totals.ts` | Minutos, reproducciones, días activos, distintos |
| `detail.ts` | Ficha de artista/track/álbum |
| `time.ts` | Agregación por hora, día de semana, mes, año |
| `streaks.ts` | Racha actual y más larga |
| `skips.ts` | Tasa de abandono (solo `source='import'`) |
| `history.ts` | Historial paginado con búsqueda |
| `genres.ts` | Agregación de géneros vía Last.fm |

**Contrato común:**

```ts
type StatsRange = { from: number; to: number; label: string }
type Metric = "plays" | "ms"
```

Toda función de ranking acepta `metric`, por defecto `"plays"`. La UI muestra **siempre las dos cifras**: un artista de temas largos gana por tiempo y pierde por reproducciones, y presentar solo una induce a error.

**Posición en el ranking:** al no haber otros usuarios, "posición" significa el puesto **dentro del ranking propio**, y cómo ha variado entre rangos (p. ej. "#3 histórico, #1 en 2019, #14 este año").

**Géneros:** se calculan sobre los **300 artistas más escuchados del rango**, ponderando cada género por las reproducciones de sus artistas. Resolver 8 000 artistas contra Last.fm no es viable. Es una aproximación y la UI lo declara explícitamente.

**Ejecución:** Server Components. Los componentes cliente se limitan a donde hay interacción real (selector de rango, buscador del historial).

### 6.5 Interfaz y navegación

Estructura elegida: **portada editorial con selector de rango permanente**. Se conserva la identidad visual actual (Fraunces + JetBrains Mono, ink sobre cream, acento chartreuse, grano).

```
/                          Portada — cifra protagonista del rango, tops, racha
/escucha                   Tops en profundidad (artistas · canciones · álbumes · géneros)
/escucha/artista/[key]     Ficha: veces, primera/última vez, posición, evolución
/escucha/cancion/[key]
/escucha/album/[key]
/historial                 Historial paginado, búsqueda, filtro de fechas
/biblioteca                Ledger — índice de playlists (home actual)
/biblioteca/playlist/[id]
/biblioteca/liked
/biblioteca/tags
/biblioteca/smart
/ajustes                   Importar dump · salud de captura · zona horaria
/api/cron/capture
/api/card/[tipo]
```

Las páginas actuales de Ledger se mueven bajo `/biblioteca` conservando su lógica. `/stats` queda absorbida por `/` y `/escucha`. `/debug` se mantiene.

El selector de rango vive en la barra superior y escribe en la URL (D6).

**Gráficas:** SVG a mano, coherente con la ausencia deliberada de librerías de UI del proyecto. Barras (evolución mensual), línea (acumulado), heatmap de 24 columnas (hora del día) y heatmap de calendario (actividad diaria).

### 6.6 Tarjetas para compartir

Route handler `/api/card/[tipo]` con `ImageResponse` de `next/og`, 1080×1920 PNG, parametrizado por rango.

| Tipo | Contenido |
|---|---|
| `top-artistas` | Top 5 del rango con reproducciones |
| `resumen` | Minutos, reproducciones y artista #1 |
| `racha` | Días consecutivos y fecha de inicio |
| `artista` | Ficha de un artista: veces, desde cuándo, puesto |

Restricciones de `next/og` a respetar desde el principio: las fuentes deben cargarse como `.ttf` desde `public/fonts/` y pasarse como buffer (no se leen desde CSS), y solo se admite un subconjunto de CSS — **flexbox sí, grid no**.

Cada vista relevante incluye un botón "Descargar tarjeta" que apunta a la ruta con el rango activo.

### 6.7 Playlists desde los tops

Reutiliza el flujo de materialización de `src/lib/smart-actions.ts`.

- Los URIs que Spotify rechace (tracks caídos del catálogo) se filtran y se informa de cuántos, en lugar de abortar la operación.
- Las filas sin `track_uri` (dump básico, archivos locales) no se pueden añadir; se excluyen y se cuentan aparte.

---

## 7. Errores, seguridad y degradación

**Seguridad**

- `/api/cron/capture` compara el secreto con `timingSafeEqual`.
- Toda Server Action nueva que toque la base llama a `requireSession()` primero, siguiendo el patrón ya documentado en `src/lib/require-session.ts`.
- El importador acepta solo nombres de archivo validados contra el listado real del directorio; nunca rutas.
- El refresh token nunca se expone al cliente ni al objeto `Session`.

**Los tres fallos silenciosos de este diseño**, todos vigilados desde `/ajustes` con estado explícito y sin "todo OK" por defecto:

1. El cron lleva horas o días sin ejecutarse.
2. El refresh token ha sido revocado.
3. `STATS_TZ` está mal configurada y desplaza todos los histogramas.

**Degradación**

- Last.fm caído → géneros vacíos, el resto funciona (comportamiento ya existente).
- Spotify 429 → rate limiter y backoff actuales.
- Base sin streams → cada página muestra un estado vacío que explica qué falta (importar el dump o esperar a la captura), no un cero suelto.

---

## 8. Pruebas

Se prueba donde el error es **invisible**: un fallo aquí produce números plausibles pero falsos. El resto se verifica mirándolo.

Tests sobre SQLite en memoria con datos sembrados:

1. **Normalización** — `Beyoncé` y `Beyonce` colapsan en la misma clave; el separador no imprimible evita colisiones entre título y artista.
2. **Buckets de zona horaria** — una escucha a las 23:30 hora local no cae en el día siguiente; se cubre un cambio de horario de verano.
3. **Dedup** — reimportar el mismo archivo deja el mismo número de filas.
4. **Regla "el dump manda"** — el borrado elimina las filas `live` dentro del rango y **no toca** las de fuera.
5. **Rachas** — un solo día; días con huecos; racha que llega hasta hoy; racha terminada ayer.
6. **Detección de formato** — extended y básico producen filas equivalentes en los campos comunes.

---

## 9. Secuencia de construcción

El dump extended no llega hasta dentro de 1–4 semanas. El orden aprovecha la espera:

**Fase 1 — Cimientos.** Tablas nuevas, normalización, `range.ts`, refactor de `spotifyFetch` en núcleo + dos envoltorios. Tests de normalización y dedup.

**Fase 2 — Captura (urgente).** `spotify_credentials`, siembra en el callback `jwt`, `spotifyFetchHeadless`, endpoint de cron, tarea programada. *Cuanto antes se active, menos historial se pierde de estas semanas.*

**Fase 3 — Importador.** Parser de ambos formatos, inserción por lotes, `import_batches`, regla D2, UI de importación. Validable con el dump básico (~5 días).

**Fase 4 — Estadísticas.** Los módulos de `src/lib/stats/`, con sus tests.

**Fase 5 — Interfaz.** Reestructuración de rutas, portada, selector de rango, tops, fichas, historial, gráficas SVG.

**Fase 6 — Extras.** Tarjetas `next/og`, playlists desde tops, y la vista que contrasta los tops de la API con los propios.

Las fases 2 y 3 pueden solaparse: escriben en la misma tabla y no dependen entre sí.

**Sobre el tamaño:** son seis fases y el conjunto excede lo razonable para un solo plan de implementación. Se plantea como **tres planes encadenados** —(1) fases 1–2, (2) fase 3, (3) fases 4–6—, cada uno con su ciclo de plan, implementación y revisión. Este documento es el diseño común a los tres.

---

## 10. Riesgos y verificaciones pendientes

| Riesgo | Mitigación |
|---|---|
| `/me/top/*` o `/me/player/recently-played` podrían no existir en este fork de la API | Comprobar en `/debug` **antes** de la Fase 2. Ya hay sondas para ambos (`src/app/debug/page.tsx:18-19`). Si `recently-played` no existe, la Fase 2 se cae y todo depende del dump. |
| Petición del dump sin confirmar por correo | Spotify exige confirmar la petición desde un email. Sin ese clic no se procesa nunca. |
| Volumen mayor del previsto | SQLite aguanta con holgura; si aparece lentitud medida, se añade `daily_rollup` (D8). |
| `next/og` no soporta CSS grid | Diseñar las tarjetas con flexbox desde el primer momento. |
| `node_modules` no está instalado en el equipo actual | `npm install` antes de empezar. |
| El fork de Next 16 difiere de la documentación conocida | Consultar `node_modules/next/dist/docs/` antes de escribir código, según `AGENTS.md`. |

---

## 11. Variables de entorno nuevas

Se añaden a `.env.local.example`, que hoy contiene `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `LASTFM_API_KEY`, `AUTH_SECRET` y `AUTH_URL`:

```
# Secreto del endpoint de captura (/api/cron/capture)
CRON_SECRET=

# Zona horaria IANA para local_date y local_hour — p. ej. America/Lima,
# Europe/Madrid. Cambiarla obliga a recalcular desde /ajustes.
STATS_TZ=
```

`STATS_TZ` es obligatoria: sin ella el importador no arranca y `/ajustes` lo indica. No se asume un valor por defecto, porque una zona horaria equivocada produce datos que parecen correctos y no lo son.
