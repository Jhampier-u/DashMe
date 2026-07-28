# Cimientos del dashboard personal

**Fecha:** 2026-07-27
**Estado:** aprobado, listo para planificar
**Sub-proyecto:** 1 de 5

---

## 1. Objetivo

Fusionar cuatro proyectos independientes en un único dashboard personal: una sola
aplicación Next, una sola base de datos, un solo login.

Este documento cubre **solo el primer sub-proyecto**: consolidar los repositorios,
levantar la estructura de la aplicación única y migrar Untap dentro de ella de punta
a punta. Los otros cuatro sub-proyectos tendrán su propio spec.

## 2. Punto de partida

Cuatro proyectos en `C:\PROYECTO JUAMPI`, cada uno con su repositorio y su remote en
GitHub (`github.com/Jhampier-u/<nombre>`):

| Proyecto | Stack | Estado |
|---|---|---|
| Portafolio | HTML/CSS/JS puro, sin build (~1.100 líneas) | Terminado. Publicado en GitHub Pages |
| SpotifyCalificar (*Album Story Maker*) | Un `index.html` de 671 líneas + html2canvas | Terminado, autocontenido |
| Untap | Next 16 · React 19.2.4 · Prisma 7 · SQLite · Tailwind 4 (~20.900 líneas) | Activo. Instalado y funcionando |
| Voidtify (*Ledger*) | Next 16 · React 19.2.4 · Drizzle · SQLite · Auth.js v5 · Tailwind 4 | Activo. **Clon pelado, sin instalar** |

### Hechos verificados

Todo lo siguiente se comprobó contra el disco, no se asumió:

- **Los stacks coinciden exactamente.** Untap y Voidtify usan las mismas versiones de
  Next (16.2.4), React (19.2.4), Tailwind (4), TypeScript (5), vitest (4.1.10) y
  `better-sqlite3` (12.9.0). No hay que reconciliar versiones.
- **Los esquemas de datos son disjuntos.** 7 modelos Prisma en Untap
  (`Habit`, `HabitLog`, `Player`, `DailyQuest`, `Task`, `Project`, `ProjectItem`)
  frente a 10 tablas Drizzle en Voidtify (`artists`, `tags`, `liked_tracks`,
  `smart_playlists`, `spotify_credentials`, `capture_state`, `import_batches`,
  `artist_resolution`, `top_snapshots`, `artist_genres`). Cero colisiones de nombre.
- **Las dos apps acceden a la base por un único punto.** `Untap/src/lib/prisma.ts` y
  `Voidtify/src/db/index.ts` son singletons con el mismo patrón, ambos sobre
  `better-sqlite3`. La conexión se sustituye en un archivo.
- **Los cuatro repos están en `main`, limpios y sincronizados con `origin`.** El repo
  raíz está en `master` **sin ningún commit**.
- **`Untap/dev.db` no está trackeado por git** — el `.gitignore` lo excluye
  explícitamente (*"datos personales — no compartir"*).
- **`dev.db` está prácticamente vacío.** Contenido real: 3 hábitos creados hoy,
  0 registros en `HabitLog`, `Player` con `xp: 0`, 0 tareas, 0 proyectos, 3 misiones
  diarias autogeneradas. Los 110 KB del archivo son esquema y las 9 migraciones de
  Prisma. **No hay datos irremplazables.**
- **Voidtify no tiene datos en esta máquina.** Sin `node_modules`, sin `.env.local`,
  sin `data/ledger.db`. Su propio `.gitignore` declara la base como
  *"user-specific cache, regenerated per machine"*.

## 3. Decisiones tomadas

| Decisión | Elección | Consecuencia |
|---|---|---|
| Alcance | Fusión total en una sola app | Una DB, un login, un deployable |
| Repositorios | Absorber los 4 en uno, conservando historia | `git subtree`, nada se borra en GitHub |
| Despliegue | Local ahora, diseñado para desplegar después | Sigue SQLite; se evitan decisiones que cierren la puerta |
| Base de la app | Shell nueva y limpia | El dashboard manda; las apps se acomodan a él |
| Alcance de Cimientos | Esqueleto + una sección viva de punta a punta | Untap dentro y funcionando; Voidtify intacto |
| Primera sección | Untap | Es la única instalada y verificable hoy; no arrastra auth |

### Por qué Untap primero

1. Está instalado y funcionando en esta máquina. Voidtify necesita `npm install`,
   credenciales de Spotify y una API key de Last.fm antes de arrancar siquiera.
2. No tiene auth, así que la primera rebanada no arrastra Auth.js. La sesión
   unificada es el sub-proyecto 3.
3. Ejercita el patrón completo — rutas, componentes, DB, server actions, cambio de
   ORM. Si funciona con Untap, Voidtify es repetir con más volumen.

### Descomposición general (contexto)

1. **Cimientos** ← este documento
2. Datos unificados — Voidtify dentro, esquema único
3. Auth unificada — una sola sesión
4. Sistema de diseño — unificar los cuatro lenguajes visuales; entran Portafolio y Album Story Maker
5. La portada — widgets con datos cruzados

## 4. Arquitectura

```
PROYECTO JUAMPI/                    ← repo único, rama main
  src/
    app/                            ← SOLO enrutado. Cero lógica de dominio.
      layout.tsx                    ← shell global + navegación
      page.tsx                      ← el dashboard
      habitos/  tareas/  proyectos/  jardin/
    modules/
      habitos/
        components/                 ← los 33 componentes de dominio de Untap
        lib/                        ← habits, streak, quests, metrics… + sus 7 tests
        schema.ts                   ← las 7 tablas, en Drizzle
        actions.ts                  ← server actions
        index.ts                    ← la única puerta pública del módulo
      core/
        db/                         ← una conexión, un schema compuesto por módulos
        ui/                         ← Button, Card, Field, Modal, PageHeader, Stat
        shell/                      ← AppShell, NavIcons
  legacy/                           ← zona de aterrizaje temporal (ver §5)
  data/juampi.db                    ← la única base de datos
  docs/superpowers/specs/           ← este documento
```

### Regla de fronteras

**`src/app` y el dashboard solo pueden importar de `modules/<x>/index.ts`.**

Nada de fuera del módulo importa `modules/habitos/lib/streak.ts` directamente. Cada
módulo expone su interfaz pública en `index.ts` y guarda el resto para sí.

Con un solo módulo esto parece burocracia. Deja de parecerlo en el sub-proyecto 5:
cuando la portada tenga que leer de hábitos y de música a la vez, la diferencia está
entre componer dos interfaces limpias o enredar el dashboard con las tripas de dos
aplicaciones. Es la regla que hace posible el resto del plan.

### Reparto del código de Untap

El reparto es directo porque Untap ya está bien ordenado:

| Origen | Destino |
|---|---|
| `src/components/{habits,tasks,projects,home,charts}` | `src/modules/habitos/components/` |
| `src/components/{GardenScene,AchievementToast,Sparkle,SoundEffects,SoundToggle,ConfirmDialog}.tsx` | `src/modules/habitos/components/` |
| `src/lib/*` (26 archivos, incluidos los 7 de test) | `src/modules/habitos/lib/` |
| `src/app/{habits,tasks,projects,garden}` | `src/app/{habitos,tareas,proyectos,jardin}` |
| `src/app/actions.ts` | `src/modules/habitos/actions.ts` |
| `src/components/ui/*` | `src/modules/core/ui/` |
| `src/components/shell/*` | `src/modules/core/shell/` |
| `src/lib/prisma.ts` | eliminado, sustituido por `src/modules/core/db/` |
| `src/generated/prisma/` | eliminado |

`ConfirmDialog` y `charts/` se quedan en `habitos/` de momento. Si el sub-proyecto 2
demuestra que Voidtify también los necesita, suben a `core/` entonces — no antes.

### Rutas en español

Las rutas se unifican en español. Untap está hoy en inglés (`/habits`, `/tasks`,
`/projects`, `/garden`) y Voidtify en español (`/biblioteca`, `/historial`,
`/ajustes`, `/escucha`, `/smart`). Gana el español porque Voidtify tiene más
superficie. Esto cambia las URLs de Untap; al ser local y sin enlaces externos, no
rompe nada.

## 5. Consolidación de los repositorios

**Obstáculo:** `git subtree add` exige que el repo destino tenga al menos un commit, y
el repo raíz no tiene ninguno. Además los cuatro directorios ya contienen árboles de
trabajo con su propio `.git` dentro.

**Procedimiento, en orden estricto:**

1. Copiar `Untap/dev.db` fuera del proyecto. Primero, antes que nada.
2. Apartar los cuatro directorios actuales a un backup fuera del repo. La raíz queda
   vacía salvo `docs/`.
3. Commit inicial en la raíz: `.gitignore`, `README.md`, `package.json` base.
   Renombrar la rama `master` a `main`.
4. Traer los cuatro repositorios con su historia completa:

   ```
   git subtree add --prefix=legacy/untap             https://github.com/Jhampier-u/Untap.git            main
   git subtree add --prefix=legacy/voidtify          https://github.com/Jhampier-u/Voidtify.git         main
   git subtree add --prefix=legacy/portafolio        https://github.com/Jhampier-u/Portafolio.git       main
   git subtree add --prefix=legacy/spotify-calificar https://github.com/Jhampier-u/SpotifyCalificar.git main
   ```
5. Mover el código de `legacy/untap/` a su destino con `git mv`, para que los
   movimientos queden trazables en vez de aparecer como borrado más creación.
6. `legacy/` se vacía conforme avanzan los sub-proyectos y desaparece al final del
   cuarto.

**Nada se borra en GitHub.** `subtree add` copia, no mueve. Los cuatro repos siguen
existiendo intactos y el Portafolio en GitHub Pages sigue publicándose igual. A partir
de ahora el desarrollo ocurre en el repo único; los cuatro originales quedan
congelados como archivo, y conviene anotarlo en sus READMEs.

## 6. Migración del esquema

No hay migración de datos, solo de esquema. Los 3 hábitos se recrean por la interfaz.
`_prisma_migrations` se descarta; el historial de esquema arranca limpio con
`drizzle-kit`.

### Reglas de traducción

| Prisma | Drizzle | Nota |
|---|---|---|
| `String @id @default(cuid())` | `text("id").primaryKey()` | cuid generado en la aplicación |
| `String` / `String?` | `text(...).notNull()` / `text(...)` | |
| `Int @default(n)` | `integer(...).notNull().default(n)` | |
| `Boolean @default(false)` | `integer(..., { mode: "boolean" }).notNull().default(false)` | |
| `DateTime` | `integer(..., { mode: "timestamp_ms" })` | **cambio deliberado**, ver abajo |
| `@@unique([a, b])` | `uniqueIndex(...).on(t.a, t.b)` | |
| `@@index([a])` | `index(...).on(t.a)` | |
| `@relation(onDelete: Cascade)` | `references(() => x.id, { onDelete: "cascade" })` | |
| `@updatedAt` | asignación explícita en las server actions | Drizzle no lo hace solo |

**Cambio deliberado en las fechas.** Prisma guarda los `DATETIME` como texto ISO con
zona horaria (`"2026-07-28T00:56:16.761+00:00"`). Pasan a enteros epoch en
milisegundos. Comparar fechas deja de depender de parsear cadenas, lo que importa en
una aplicación cuyo núcleo es *"¿cumplí ayer?"*. La lógica de día local de
`lib/day.ts` no cambia; solo cambia el almacenamiento.

**Restricciones que deben sobrevivir.** `@@unique([habitId, date])` en `HabitLog`
impide registrar dos veces el mismo hábito el mismo día, y de eso depende el cálculo
de rachas. `@@unique([date, kind])` en `DailyQuest` cumple el papel equivalente para
las misiones. Perder cualquiera de las dos corrompe la lógica en silencio, sin error
visible. Además: `@@index([date])` en `HabitLog` y `DailyQuest`, y
`@@index([projectId])` y `@@index([parentId])` en `ProjectItem`.

`Player.id` conserva su `@default("default")`: es una tabla de una sola fila. Cuando
llegue la auth en el sub-proyecto 3 habrá que revisitarlo, pero no ahora.

### Auto-creación de tablas

Se adopta el patrón que Voidtify ya usa en `src/db/index.ts`: `SCHEMA_SQL` idempotente
ejecutado al abrir la conexión, más `journal_mode = WAL`, `foreign_keys = ON` y
`busy_timeout = 5000`. Es la convención existente del proyecto que absorbe más
superficie y funciona; no se inventa otra.

## 7. Riesgos

**Bugs sutiles al reescribir las consultas.** 26 archivos de `lib/` pasan de Prisma a
Drizzle, y ahí vive la lógica de rachas, escudos y XP. La red ya existe: Untap tiene
7 archivos de test, y `streak.test.ts` y `metrics.test.ts` cubren exactamente esa
lógica. Se migran **primero** y deben pasar antes de dar por buena la conversión. Los
tests son la especificación: si durante la migración hay que cambiar lo que un test
espera, es señal de que algo se rompió.

**Next 16 no es el Next que conozco.** Los `AGENTS.md` de ambos proyectos lo advierten
explícitamente. Consultar `node_modules/next/dist/docs/` antes de escribir rutas o
server actions, en lugar de improvisar de memoria.

**Deriva de alcance.** En este sub-proyecto no se cambia ninguna decisión de producto
ni de diseño visual. Untap debe verse y comportarse exactamente igual, solo que en
otra URL y sobre otro ORM. Todo lo estético es el sub-proyecto 4.

**Rollback.** Backup completo de los cuatro directorios antes de empezar y los cuatro
repos intactos en GitHub. Si algo sale mal: borrar la raíz, volver a clonar, coste
cero. No hay punto de no retorno en ninguna parte del plan.

## 8. Estrategia de pruebas

Los 7 archivos de test existentes (`streak`, `metrics`, `day`, `flow`, `garden`,
`chart`, `color`) se migran sin cambiar sus expectativas y se ejecutan antes de dar
por válida la conversión de cada archivo de `lib/`.

Se añade **un** test nuevo, el único hueco real que deja el cambio de ORM: un ciclo
completo crear hábito → marcarlo → comprobar XP y racha, contra una base SQLite en
memoria. Cubre la capa de datos nueva de punta a punta.

No se escriben tests adicionales para lógica ya cubierta.

## 9. Criterios de aceptación

1. `git log` en la raíz muestra la historia de los cuatro repositorios
2. `npm run build` pasa
3. `npm run test` pasa — los 7 archivos migrados más el nuevo, en verde
4. `npm run lint` y `tsc --noEmit` limpios
5. `npm run dev` levanta y las cuatro pantallas funcionan de verdad: crear un hábito,
   marcarlo, ver crecer la planta, sumar XP
6. Cero rastro de Prisma en `package.json`; `src/generated/` eliminado
7. `/` existe con navegación a las secciones — dashboard mínimo, pero real
8. Voidtify intacto en `legacy/voidtify/`, sin tocar

## 10. Fuera de alcance

- Voidtify, Portafolio y Album Story Maker: solo aterrizan en `legacy/`, no se migran
- Autenticación de cualquier tipo
- Cambios visuales, de tokens de diseño o de tipografía
- Widgets con datos cruzados en la portada
- Cualquier cambio de comportamiento en Untap
- Despliegue
