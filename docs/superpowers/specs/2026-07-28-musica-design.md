# Módulo de música — Voidtify dentro del dashboard

**Fecha:** 2026-07-28
**Estado:** aprobado, listo para planificar
**Sub-proyecto:** 2 de 5

---

## 1. Objetivo

Meter Voidtify entero dentro de la aplicación única como módulo `musica`, con una
sola base de datos y el login de Spotify funcionando, sin perder ocho años de
historial de escucha.

Cimientos (sub-proyecto 1) ya está hecho: Untap vive en `src/modules/habitos/` sobre
Drizzle, con rutas en español y 178 tests en verde.

## 2. Punto de partida

Voidtify (*Ledger*) es un organizador de la biblioteca de Spotify: Next 16, Drizzle,
Auth.js v5, Last.fm como fuente de géneros. **12.670 líneas, 14 rutas, 23 componentes
y 23 archivos de test.**

Existe en dos sitios y hay que distinguirlos con cuidado:

- **`legacy/voidtify/`** — el código, traído con `git subtree` en Cimientos. Sin
  instalar, sin datos.
- **`C:\Voidtify`** — la instalación real, **fuera de este repo**. Mismo commit
  (`6aba138`), instalada, con un servidor de desarrollo corriendo y 158 MB de datos.

### Los datos, verificados

Contenido real de `C:\Voidtify\data\ledger.db`:

| Tabla | Filas |
|---|---|
| `streams` | **271.769** |
| `import_batches` | 44 |
| `artist_genres` | 40 |
| `top_snapshots` | 6 |
| `capture_state` | 1 |
| `spotify_credentials` | 1 |
| `artists`, `artist_resolution`, `liked_tracks`, `smart_playlists`, `tags`, `track_tags` | 0 |

`streams` cubre de **2018-09-17 a 2026-07-28** — 31.117 canciones distintas — y se
importó de `Streaming_History_Audio_*.json`, el volcado extendido que Spotify entrega
bajo petición GDPR.

**Es irreemplazable.** La API de Spotify solo devuelve las últimas 50 reproducciones;
recuperar esto significa solicitar el volcado de nuevo y esperar hasta 30 días, y aun
así se perdería lo que el cron ha capturado desde entonces. Es el dato de mayor valor
de todo el proyecto.

La contrapartida es que **la migración es esencialmente una tabla**: tags, smart
playlists y los cachés de artistas y canciones están vacíos, así que no hay nada que
reconciliar.

### Otros hechos comprobados

- **Los esquemas de hábitos y música son disjuntos.** Cero colisiones entre las 7
  tablas de `habitos` y las 12 de `musica`.
- **`src/auth.ts` son 227 líneas** y buena parte es un parche: Auth.js calcula el
  origen del callback como `localhost` aunque la petición llegue por `127.0.0.1`, y
  Spotify rechaza `localhost` en apps nuevas. Sin ese parche el canje de token falla
  con `invalid_grant`.
- **`AUTH_URL=http://127.0.0.1:3000`** — el redirect URI registrado en el panel de
  Spotify. Exige coincidencia exacta.
- **Los tests de Voidtify viven en `tests/`**, no en `src/`, y su configuración usa un
  alias propio más un stub de `server-only`. La configuración actual del dashboard
  solo mira `src/**/*.test.ts`.
- **Todas las páginas exigen sesión**, pero las de estadísticas solo la usan como
  verja de acceso y para pintar el perfil: los datos salen de `streams`, en local.

## 3. Decisiones tomadas

| Decisión | Elección | Consecuencia |
|---|---|---|
| `C:\Voidtify` | Copiar los datos y dejarla congelada | Red de seguridad hasta que el usuario la borre |
| Alcance | Voidtify entero, con Auth.js | El sub-proyecto 3 pasa a *reconciliar* la sesión, no a añadirla |
| Login | Solo protege `/musica` | Hábitos y tareas siguen funcionando sin sesión y sin red |
| Rutas | Bajo el prefijo `/musica/` | Evita 18 rutas planas y nombres genéricos como `/stats` |
| Migración de datos | `ATTACH` + `INSERT … SELECT` | SQL puro, una transacción, verificable por conteo |

### Por qué Voidtify entero y no solo las estadísticas

Partirlo obligaría a reescribir cada página de estadísticas para quitarle la verja de
sesión y la llamada a `getMe()`. Modificar código durante una migración es justo lo
que Cimientos evitó, y fue la razón de que saliera limpio: cuando algo falla, quieres
saber si fue la migración o el cambio, no las dos cosas a la vez.

### Por qué `ATTACH` y no copiar el archivo

Copiar `ledger.db` encima de `juampi.db` tiene el atractivo de que el dato grande no
se mueve. Pero invierte la dirección del proyecto —la música pasaría a ser la base y
los hábitos el añadido— y obliga a rescatar aparte los datos de hábitos. Un script en
Node sería necesario si hubiera que transformar algo; no lo hay, porque ambos
esquemas salen del mismo repositorio. `ATTACH` es lo más simple que funciona.

## 4. Arquitectura

```
src/
  app/
    musica/                    ← las 14 rutas, tras el guard de sesión
      layout.tsx               ← aquí vive el guard
      biblioteca/  historial/  stats/  tags/  smart/  ajustes/
      escucha/{album,artista,cancion}/[key]/   escucha/contraste/
      playlist/[id]/
    api/
      auth/[...nextauth]/      ← Auth.js
      cron/capture/            ← captura de reproducciones recientes
  modules/
    musica/
      components/              ← los 23
      lib/                     ← spotify, lastfm, stats/, capture/, import/
      schema.ts                ← las 12 tablas
      actions.ts               ← envoltorio "use server"
      index.ts                 ← la única puerta del módulo
    core/
      auth/                    ← auth.ts con su parche de loopback
      db/                      ← ya existe; se le añade el esquema de música
```

Se mantienen las reglas de `AGENTS.md`: `src/app` solo enruta, la lógica que toca
datos recibe la base por parámetro, y los server actions son envoltorios finos que
inyectan el singleton.

**El guard va en `src/app/musica/layout.tsx`.** Un único punto de control para las 14
rutas, y hábitos y tareas quedan fuera de él por construcción. Las server actions de
música conservan su `requireSession()` propio: son endpoints HTTP públicos y el
layout no las protege.

**`auth.ts` sube a `core/auth/`** porque el sub-proyecto 3 tendrá que reconciliar la
sesión entre módulos. Su contenido no se toca.

## 5. Datos

Una sola base, `data/juampi.db`, con las 7 tablas de hábitos y las 12 de música.
`src/modules/core/db/schema.ts` compone ambos esquemas y `SCHEMA_SQL` gana el bloque
de creación de las tablas de música.

`spotify_credentials` **no se migra**: son tokens de acceso que caducan y se
regeneran al iniciar sesión. Migrar un token muerto solo genera confusión al depurar.

`C:\Voidtify` se lee y no se escribe en ningún momento.

## 6. Procedimiento de migración

El orden es parte del diseño, no un detalle de implementación.

1. **Parar el servidor de `C:\Voidtify`.** Nada de lo siguiente es fiable con un
   proceso escribiendo.
2. **Consolidar el WAL**: `PRAGMA wal_checkpoint(TRUNCATE)`. Ahora mismo hay 9 MB de
   `ledger.db-wal` sin volcar. Copiar el `.db` sin esto se lleva una foto vieja y
   pierde lo último capturado **sin ningún error visible**.
3. **Copia de seguridad** de `ledger.db` ya consolidado, fuera del proyecto.
4. **Copia de seguridad** de `juampi.db`.
5. **`ATTACH` + `INSERT INTO … SELECT`** de las cinco tablas con datos, dentro de una
   transacción.
6. **Verificar los conteos** contra el origen. Si no cuadran, no se confirma la
   transacción.

## 7. Riesgos

**El WAL sin consolidar.** El riesgo más grave y el más silencioso: se manifiesta
como "faltan las últimas semanas de escuchas" semanas después, cuando ya no hay
vuelta atrás. Por eso el checkpoint es el paso 2 y no una nota al pie.

**El parche de `auth.ts`.** Viaja sin tocar una coma. Si el login falla tras la
migración, el sospechoso es ese archivo antes que cualquier otro.

**El puerto 3000.** El dashboard debe acabar ahí o hay que registrar un redirect URI
nuevo en el panel de Spotify. Mientras `C:\Voidtify` corra, el puerto está ocupado.

**Los tests que no se ejecutan.** Si la configuración de vitest no cubre `tests/**`
antes de mover nada, los 23 archivos que deberían proteger la migración simplemente
no corren, y el silencio se confunde con el verde. Se arregla **antes** de mover.

**`STATS_TZ`.** Sin ella las fechas locales salen mal, y `local_date` y `local_hour`
están grabados en las 271.769 filas: cambiarla después obliga a recalcular todo desde
`/musica/ajustes`.

**Deriva de alcance.** Ningún cambio de producto ni de diseño visual. Voidtify debe
verse y comportarse idéntico, solo que bajo `/musica/` y sobre la base compartida.

**Rollback.** `C:\Voidtify` queda intacta con los 158 MB, más las copias de los pasos
3 y 4. No hay punto de no retorno.

## 8. Pruebas

Los 23 archivos de test se migran **sin cambiar una sola expectativa**. Entre ellos,
`schema-parity.test.ts` verifica que el esquema de Drizzle y el SQL de creación no
diverjan — precisamente el fallo que más caro sale y el que ningún typecheck detecta.

Se añade **un** test nuevo: que la copia de datos preserva conteos y claves, contra
dos bases SQLite en memoria.

La configuración de vitest pasa a incluir `src/**/*.test.ts` y `tests/**/*.test.ts`,
con el alias de `server-only` que Voidtify necesita.

## 9. Criterios de aceptación

1. `git log` sigue mostrando las historias de los cuatro repositorios
2. `npm run build`, `test`, `lint` y `tsc --noEmit` en verde — los 178 tests actuales
   más los 23 archivos de Voidtify
3. Las 271.769 filas están en `juampi.db` y los conteos cuadran con el origen
4. El login de Spotify funciona y `/musica/historial` muestra el historial real
5. Hábitos y tareas funcionan **sin sesión iniciada**
6. `legacy/voidtify` vacío y eliminado
7. `C:\Voidtify` intacta, sin una sola escritura
8. El dashboard corre en `127.0.0.1:3000`

El criterio 8 depende de que el servidor de `C:\Voidtify` esté parado: mientras corra,
tiene el puerto tomado. Si el usuario prefiere mantenerlo vivo un tiempo, el dashboard
puede quedarse en el 3100 y este criterio se aplaza — pero entonces **el login de
Spotify no funcionará** hasta registrar `http://127.0.0.1:3100/api/auth/callback/spotify`
como redirect URI adicional en el panel de Spotify. Es una casilla más, no un
problema; solo hay que decidirlo conscientemente en vez de descubrirlo cuando falle
el login.

## 10. Fuera de alcance

- Portafolio y Album Story Maker (sub-proyecto 4)
- Unificar el lenguaje visual entre hábitos y música (sub-proyecto 4)
- Los widgets con datos cruzados en la portada (sub-proyecto 5)
- Reconciliar el modelo de sesión entre módulos (sub-proyecto 3)
- Cualquier cambio de comportamiento en Voidtify
- Borrar `C:\Voidtify` — esa decisión es del usuario, no de este plan
- Despliegue
