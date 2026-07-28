# Cimientos del dashboard unificado — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidar los cuatro repositorios en uno solo conservando su historia, y dejar Untap funcionando de punta a punta dentro de una aplicación Next única con rutas en español y Drizzle en lugar de Prisma.

**Architecture:** Una sola app Next 16 en la raíz. `src/app` solo enruta; toda la lógica vive en `src/modules/<dominio>/` y se expone por un único `index.ts`. `src/modules/core/` guarda lo compartido (conexión a la base, `ui/`, `shell/`). Una sola base SQLite en `data/juampi.db`, con el esquema compuesto por los módulos.

**Tech Stack:** Next 16.2.4 · React 19.2.4 · TypeScript 5 · Tailwind 4 · Drizzle ORM 0.45 · better-sqlite3 12.9 · vitest 4.1

**Spec:** `docs/superpowers/specs/2026-07-27-cimientos-dashboard-design.md`

---

## Antes de empezar: lee esto

**Next 16 no es el Next que crees conocer.** Tiene cambios de API respecto a lo que hay en tu entrenamiento. Antes de escribir rutas, layouts o server actions, consulta `node_modules/next/dist/docs/`. No improvises de memoria.

**Convenciones de Drizzle en este repo.** La referencia autoritativa es `legacy/voidtify/src/db/schema.ts`. De ahí se toma:
- Nombres de tabla y columna en `snake_case`
- Forma **objeto** para índices: `(t) => ({ nombre: index(...).on(...) })`, no la forma array
- `export type XRow = typeof x.$inferSelect;` tras cada tabla
- Conexión singleton con `SCHEMA_SQL` idempotente, `journal_mode = WAL`, `foreign_keys = ON`, `busy_timeout = 5000`

**Dos desviaciones deliberadas respecto a Voidtify**, ambas justificadas y ambas sin efecto en el almacenamiento físico:

1. **`{ mode: "timestamp_ms" }` para fechas.** Voidtify usa `integer(...)` crudo y maneja números. El código de Untap trabaja con objetos `Date` en todas partes (`normalizeDayKey(l.date)`, `l.date.getTime()`). Con `mode: "timestamp_ms"` Drizzle convierte solo y los 19 archivos puros de `lib/` siguen funcionando sin tocarlos. En disco es el mismo INTEGER epoch en milisegundos.
2. **`{ mode: "boolean" }` para booleanos.** Mismo razonamiento: el código existente espera `true`/`false`. En disco es el mismo INTEGER 0/1.

**No se usa la API relacional de Drizzle** (`db.query.x.findMany({ with: ... })`). Voidtify no la usa y requiere declarar `relations()`. En su lugar, dos `select` y agrupación en JavaScript. Ver Tarea 12 para el patrón exacto y para una trampa importante con `_count`.

**Alcance.** No se cambia ninguna decisión de producto ni de diseño visual. Untap debe verse y comportarse igual que ahora. Todo lo estético es el sub-proyecto 4.

**Desviación consciente respecto al spec.** El spec (§8) preveía **un** test nuevo. Este plan crea **siete**: uno por cada archivo con acceso a datos, más el de la base en memoria. La razón es que cada traducción a Drizzle necesita su propio test que falle antes de escribirla — sin eso no hay forma de saber si una consulta reescrita devuelve lo mismo que la anterior, y son 61 puntos donde equivocarse. No contradicen la otra mitad de §8: siguen sin escribirse tests para lógica ya cubierta por los 7 archivos puros, solo para la capa de datos, que es código enteramente nuevo.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `package.json` | Único manifiesto. Sin Prisma. |
| `next.config.ts` | `serverExternalPackages: ["better-sqlite3"]` |
| `tsconfig.json` | `@/*` → `./src/*` |
| `vitest.config.mts` | `TZ=America/Lima`, incluye `src/**/*.test.ts` |
| `drizzle.config.ts` | Apunta a `data/juampi.db` y al esquema compuesto |
| `src/modules/core/db/schema.ts` | Reexporta los esquemas de todos los módulos |
| `src/modules/core/db/schema-sql.ts` | `SCHEMA_SQL` idempotente para auto-crear tablas |
| `src/modules/core/db/index.ts` | Conexión singleton `db` |
| `src/modules/core/db/testing.ts` | `createTestDb()` en memoria, para los tests |
| `src/modules/core/ui/*` | `Button`, `Card`, `Field`, `Modal`, `PageHeader`, `Stat` |
| `src/modules/core/shell/*` | `AppShell`, `NavIcons` |
| `src/modules/habitos/schema.ts` | Las 7 tablas del dominio |
| `src/modules/habitos/lib/*` | 19 archivos puros + 6 con acceso a datos + 7 de test |
| `src/modules/habitos/components/*` | Los 33 componentes de dominio |
| `src/modules/habitos/actions.ts` | Los 18 server actions |
| `src/modules/habitos/index.ts` | Interfaz pública del módulo |
| `src/app/layout.tsx` | Shell global |
| `src/app/page.tsx` | Dashboard |
| `src/app/{habitos,tareas,proyectos,jardin}/page.tsx` | Rutas del módulo |

---

# Fase A · Consolidación de los repositorios

### Tarea 1: Poner a salvo lo que no está en git

**Files:**
- Copiar: `Untap/dev.db`, `Untap/.env`

- [ ] **Paso 1: Copiar la base y el `.env` fuera del proyecto**

Ninguno de los dos está trackeado por git. Si se pierden, se pierden.

```bash
mkdir -p ~/backup-juampi
cp "/c/PROYECTO JUAMPI/Untap/dev.db" ~/backup-juampi/
cp "/c/PROYECTO JUAMPI/Untap/.env" ~/backup-juampi/
ls -la ~/backup-juampi
```

Esperado: los dos archivos listados, `dev.db` de unos 110 KB.

- [ ] **Paso 2: Copia completa de los cuatro directorios**

Red de seguridad por si un `subtree` sale mal.

```bash
cp -r "/c/PROYECTO JUAMPI/Portafolio" "/c/PROYECTO JUAMPI/SpotifyCalificar" "/c/PROYECTO JUAMPI/Untap" "/c/PROYECTO JUAMPI/Voidtify" ~/backup-juampi/
ls ~/backup-juampi
```

Esperado: `Portafolio  SpotifyCalificar  Untap  Voidtify  dev.db  .env`

- [ ] **Paso 3: Confirmar que los cuatro repos están limpios y publicados**

```bash
cd "/c/PROYECTO JUAMPI"
for d in Portafolio SpotifyCalificar Untap Voidtify; do
  echo "== $d: $(git -C $d status --porcelain | wc -l) cambios sin commitear"
  git -C "$d" status -sb | head -1
done
```

Esperado: `0 cambios` en los cuatro, y ninguno con `[ahead N]`. Si alguno tiene cambios o commits sin publicar, **detente** y resuélvelo antes de seguir: el `subtree` lee del remote, no del disco, y esos cambios se perderían.

---

### Tarea 2: Dejar la raíz limpia y hacer el commit base

**Files:**
- Create: `.gitignore`, `README.md`

- [ ] **Paso 1: Retirar los cuatro directorios de la raíz**

Ya están respaldados en la Tarea 1 y viven en GitHub. La raíz debe quedar solo con `docs/` y `.git/`.

```bash
cd "/c/PROYECTO JUAMPI"
rm -rf Portafolio SpotifyCalificar Untap Voidtify
ls -a
```

Esperado: `.  ..  .git  docs`

- [ ] **Paso 2: Crear el `.gitignore`**

```gitignore
# Dependencias
node_modules/

# Next
.next/
out/
build/
next-env.d.ts
*.tsbuildinfo

# Entorno
.env
.env*.local

# SQLite (datos personales — no compartir)
data/
*.db
*.db-journal
*.db-shm
*.db-wal

# Sistema
.DS_Store
Thumbs.db
```

- [ ] **Paso 3: Crear el `README.md`**

```markdown
# Dashboard personal

Un solo lugar para mis apps, hábitos y música.

Fusiona cuatro proyectos que antes vivían por separado:
[Untap](https://github.com/Jhampier-u/Untap) (hábitos, tareas y proyectos),
[Voidtify](https://github.com/Jhampier-u/Voidtify) (organizador de Spotify),
[Portafolio](https://github.com/Jhampier-u/Portafolio) y
[SpotifyCalificar](https://github.com/Jhampier-u/SpotifyCalificar).
Esos cuatro repos quedan congelados como archivo: el desarrollo ocurre aquí.

## Arranque

```bash
npm install
npm run dev
```

## Estructura

- `src/app/` — solo enrutado
- `src/modules/<dominio>/` — la lógica, expuesta por su `index.ts`
- `src/modules/core/` — conexión a la base, `ui/`, `shell/`
- `docs/superpowers/` — specs y planes

Los módulos no se importan por dentro: solo a través de su `index.ts`.
```

- [ ] **Paso 4: Commit**

```bash
cd "/c/PROYECTO JUAMPI"
git add .gitignore README.md
git commit -m "chore: base del repo unificado"
git log --oneline
```

Esperado: dos commits — el del spec y este.

---

### Tarea 3: Traer los cuatro repositorios con su historia

**Files:**
- Create: `legacy/untap/`, `legacy/voidtify/`, `legacy/portafolio/`, `legacy/spotify-calificar/`

- [ ] **Paso 1: Añadir los cuatro subtrees**

Cada comando trae la historia completa del repositorio dentro del repo único. Ejecútalos de uno en uno y revisa la salida de cada uno antes del siguiente.

```bash
cd "/c/PROYECTO JUAMPI"
git subtree add --prefix=legacy/untap             https://github.com/Jhampier-u/Untap.git            main
git subtree add --prefix=legacy/voidtify          https://github.com/Jhampier-u/Voidtify.git         main
git subtree add --prefix=legacy/portafolio        https://github.com/Jhampier-u/Portafolio.git       main
git subtree add --prefix=legacy/spotify-calificar https://github.com/Jhampier-u/SpotifyCalificar.git main
```

Esperado en cada uno: `Added dir 'legacy/<nombre>'`.

Si alguno falla con `Working tree has modifications`, commitea o descarta lo pendiente y repite solo ese.

- [ ] **Paso 2: Verificar que la historia viajó**

```bash
cd "/c/PROYECTO JUAMPI"
git log --oneline | wc -l
# El commit de merge del subtree: su SEGUNDO padre es la historia original.
MERGE=$(git log --oneline --grep="Add 'legacy/portafolio/'" --format=%H)
git log --oneline "$MERGE^2" | tail -3
```

Esperado: bastante más de 4 commits en total, y en el segundo comando los commits originales del Portafolio (`first commit`, `Arrelo`, `mk`).

**No uses `git log -- legacy/portafolio`.** La simplificación de historia de git se detiene en el commit de merge, porque los commits originales tocaban `index.html` y no `legacy/portafolio/index.html`. Da un solo commit aunque la historia esté entera, y parece un `--squash` que no ocurrió. Comprueba siempre por el segundo padre, o por SHA: `git log -1 9a9fe62` debe resolver.

- [ ] **Paso 3: Confirmar que no quedaron `.git` anidados**

```bash
find legacy -maxdepth 2 -name ".git"
```

Esperado: **sin salida**. `subtree add` no trae el `.git` del origen; si aparece alguno, algo se copió a mano y hay que borrarlo.

- [ ] **Paso 4: Commit**

Los `subtree add` ya commitean solos. Solo verifica que el árbol está limpio:

```bash
git status --porcelain
```

Esperado: sin salida.

---

### Tarea 4: Anotar en los repos originales que quedan congelados

**Files:**
- Modify: el `README.md` de cada uno de los cuatro repos en GitHub

- [ ] **Paso 1: Añadir el aviso en cada repo original**

Esto se hace en los repositorios originales, no en el unificado. Para cada uno de los cuatro, añade al principio de su `README.md`:

```markdown
> **Archivado.** El desarrollo continúa en el repo del dashboard personal,
> donde este proyecto vive fusionado junto a los demás. Este repositorio se
> conserva como referencia histórica y ya no recibe cambios.
```

- [ ] **Paso 2: Confirmar con el usuario antes de publicar**

Estos cambios se publican en repositorios públicos de GitHub. **Pregunta al usuario antes de hacer `push`** y no lo hagas sin un sí explícito. Si prefiere hacerlo a mano o dejarlo para después, sáltate esta tarea entera: no bloquea nada.

---

# Fase B · Esqueleto de la aplicación

### Tarea 5: Manifiesto y configuración

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `postcss.config.mjs`, `eslint.config.mjs`, `vitest.config.mts`, `drizzle.config.ts`

- [ ] **Paso 1: Crear `package.json`**

Las versiones son las que ya comparten las dos apps. Sin Prisma.

```json
{
  "name": "dashboard-personal",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -H 127.0.0.1",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio"
  },
  "dependencies": {
    "better-sqlite3": "^12.9.0",
    "drizzle-orm": "^0.45.2",
    "next": "16.2.4",
    "react": "19.2.4",
    "react-dom": "19.2.4"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/better-sqlite3": "^7.6.13",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "drizzle-kit": "^0.31.10",
    "eslint": "^9",
    "eslint-config-next": "16.2.4",
    "tailwindcss": "^4",
    "typescript": "^5",
    "vitest": "^4.1.10"
  }
}
```

`dev` usa `-H 127.0.0.1` desde ya: Spotify no acepta `localhost` como redirect URI y en el sub-proyecto 3 hará falta. Fijarlo ahora evita una migración de URLs después.

- [ ] **Paso 2: Copiar las configuraciones que no cambian**

```bash
cd "/c/PROYECTO JUAMPI"
git mv legacy/untap/tsconfig.json      tsconfig.json
git mv legacy/untap/postcss.config.mjs postcss.config.mjs
git mv legacy/untap/eslint.config.mjs  eslint.config.mjs
git mv legacy/untap/vitest.config.mts  vitest.config.mts
```

- [ ] **Paso 3: Crear `next.config.ts`**

Sin el adaptador de Prisma, que ya no existe.

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 es un módulo nativo: nunca debe entrar en el bundle del
  // servidor, hay que cargarlo con require en tiempo de ejecución.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
```

- [ ] **Paso 4: Crear `drizzle.config.ts`**

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/modules/core/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: "./data/juampi.db" },
});
```

- [ ] **Paso 5: Instalar y verificar**

```bash
cd "/c/PROYECTO JUAMPI"
npm install
npx tsc --noEmit
```

Esperado: `npm install` termina sin errores. `tsc` puede quejarse de que no encuentra archivos porque `src/` aún no existe — eso es correcto en este punto.

- [ ] **Paso 6: Commit**

```bash
git add package.json package-lock.json next.config.ts tsconfig.json postcss.config.mjs eslint.config.mjs vitest.config.mts drizzle.config.ts
git commit -m "chore: manifiesto y configuración de la app única"
```

---

### Tarea 6: El esquema de datos del módulo de hábitos

**Files:**
- Create: `src/modules/habitos/schema.ts`

- [ ] **Paso 1: Escribir el esquema completo**

Traducción de los 7 modelos de Prisma. Nombres de tabla y columna en `snake_case` siguiendo la convención del repo; los nombres de propiedad en TypeScript se mantienen en `camelCase` para que el código existente no cambie.

```ts
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const habits = sqliteTable("habits", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  icon: text("icon").notNull().default("star"),
  color: text("color").notNull().default("aqua"),
  /** flower | tree | mushroom | cactus | herb */
  plantSpecies: text("plant_species").notNull().default("flower"),
  minimalGoal: text("minimal_goal"),
  isAnchor: integer("is_anchor", { mode: "boolean" }).notNull().default(false),
  /** 7 caracteres dom→sáb, 1 = activo, 0 = se salta. */
  schedule: text("schedule").notNull().default("1111111"),
  /** "Cuando X entonces Y" */
  intention: text("intention"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export type HabitRow = typeof habits.$inferSelect;

export const habitLogs = sqliteTable(
  "habit_logs",
  {
    id: text("id").primaryKey(),
    habitId: text("habit_id")
      .notNull()
      .references(() => habits.id, { onDelete: "cascade" }),
    date: integer("date", { mode: "timestamp_ms" }).notNull(),
    partial: integer("partial", { mode: "boolean" }).notNull().default(false),
    shielded: integer("shielded", { mode: "boolean" }).notNull().default(false),
    /**
     * XP concedido al crear este registro (base + ancla + hito). Al borrarlo se
     * devuelve exactamente esto, así marcar/desmarcar siempre suma cero.
     */
    xpAwarded: integer("xp_awarded").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => ({
    // Impide registrar dos veces el mismo hábito el mismo día. De esto depende
    // el cálculo de rachas: si se pierde, la lógica se corrompe en silencio.
    unqHabitDate: uniqueIndex("habit_logs_habit_date_unq").on(t.habitId, t.date),
    byDate: index("habit_logs_date_idx").on(t.date),
  }),
);

export type HabitLogRow = typeof habitLogs.$inferSelect;

/** Tabla de una sola fila con id fijo "default". Se revisita con la auth. */
export const player = sqliteTable("player", {
  id: text("id").primaryKey(),
  xp: integer("xp").notNull().default(0),
  shields: integer("shields").notNull().default(2),
  shieldsUpdated: integer("shields_updated", {
    mode: "timestamp_ms",
  }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export type PlayerRow = typeof player.$inferSelect;

export const dailyQuests = sqliteTable(
  "daily_quests",
  {
    id: text("id").primaryKey(),
    /** Inicio del día en UTC. */
    date: integer("date", { mode: "timestamp_ms" }).notNull(),
    /** QUEST_3_HABITS | QUEST_EARLY | QUEST_TASK | QUEST_PERFECT | QUEST_TREE */
    kind: text("kind").notNull(),
    target: integer("target").notNull().default(1),
    progress: integer("progress").notNull().default(0),
    xpReward: integer("xp_reward").notNull().default(50),
    completed: integer("completed", { mode: "boolean" })
      .notNull()
      .default(false),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  },
  (t) => ({
    unqDateKind: uniqueIndex("daily_quests_date_kind_unq").on(t.date, t.kind),
    byDate: index("daily_quests_date_idx").on(t.date),
  }),
);

export type DailyQuestRow = typeof dailyQuests.$inferSelect;

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  /** TODO | IN_PROGRESS | DONE */
  status: text("status").notNull().default("TODO"),
  order: integer("order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
});

export type TaskRow = typeof tasks.$inferSelect;

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon").notNull().default("📁"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export type ProjectRow = typeof projects.$inferSelect;

export const projectItems = sqliteTable(
  "project_items",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    parentId: text("parent_id"),
    title: text("title").notNull(),
    /** TODO | IN_PROGRESS | DONE */
    status: text("status").notNull().default("TODO"),
    order: integer("order").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  },
  (t) => ({
    byProject: index("project_items_project_idx").on(t.projectId),
    byParent: index("project_items_parent_idx").on(t.parentId),
  }),
);

export type ProjectItemRow = typeof projectItems.$inferSelect;
```

**Sobre `parentId`:** el árbol de subtareas es autorreferencial. En Drizzle una referencia a la propia tabla dentro del objeto de columnas provoca un error de inicialización circular, así que la clave foránea se declara en el SQL de la Tarea 7, no aquí. El índice sí va aquí.

- [ ] **Paso 2: Verificar que compila**

```bash
npx tsc --noEmit
```

Esperado: sin errores de este archivo.

- [ ] **Paso 3: Commit**

```bash
git add src/modules/habitos/schema.ts
git commit -m "feat(habitos): esquema Drizzle de las 7 tablas"
```

---

### Tarea 7: La conexión a la base

**Files:**
- Create: `src/modules/core/db/schema.ts`, `src/modules/core/db/schema-sql.ts`, `src/modules/core/db/index.ts`

- [ ] **Paso 1: Crear el esquema compuesto**

`src/modules/core/db/schema.ts`. Este archivo es el único punto donde se enteran unos módulos de la existencia de otros a nivel de datos. Cuando entre Voidtify en el sub-proyecto 2, añade una línea aquí.

```ts
export * from "@/modules/habitos/schema";
```

- [ ] **Paso 2: Crear el SQL de auto-creación**

`src/modules/core/db/schema-sql.ts`. Idempotente: se ejecuta en cada arranque sin efecto si las tablas ya existen. Es el mismo patrón que usa Voidtify.

```ts
/**
 * Auto-creación idempotente de tablas al abrir la conexión. Red de seguridad
 * para el arranque en una máquina nueva; los cambios de esquema a partir de
 * aquí deberían pasar por migraciones versionadas (`npm run db:generate`).
 */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS habits (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  icon          TEXT NOT NULL DEFAULT 'star',
  color         TEXT NOT NULL DEFAULT 'aqua',
  plant_species TEXT NOT NULL DEFAULT 'flower',
  minimal_goal  TEXT,
  is_anchor     INTEGER NOT NULL DEFAULT 0,
  schedule      TEXT NOT NULL DEFAULT '1111111',
  intention     TEXT,
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS habit_logs (
  id         TEXT PRIMARY KEY,
  habit_id   TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  date       INTEGER NOT NULL,
  partial    INTEGER NOT NULL DEFAULT 0,
  shielded   INTEGER NOT NULL DEFAULT 0,
  xp_awarded INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS habit_logs_habit_date_unq ON habit_logs(habit_id, date);
CREATE INDEX IF NOT EXISTS habit_logs_date_idx ON habit_logs(date);

CREATE TABLE IF NOT EXISTS player (
  id              TEXT PRIMARY KEY,
  xp              INTEGER NOT NULL DEFAULT 0,
  shields         INTEGER NOT NULL DEFAULT 2,
  shields_updated INTEGER NOT NULL,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_quests (
  id           TEXT PRIMARY KEY,
  date         INTEGER NOT NULL,
  kind         TEXT NOT NULL,
  target       INTEGER NOT NULL DEFAULT 1,
  progress     INTEGER NOT NULL DEFAULT 0,
  xp_reward    INTEGER NOT NULL DEFAULT 50,
  completed    INTEGER NOT NULL DEFAULT 0,
  completed_at INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS daily_quests_date_kind_unq ON daily_quests(date, kind);
CREATE INDEX IF NOT EXISTS daily_quests_date_idx ON daily_quests(date);

CREATE TABLE IF NOT EXISTS tasks (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'TODO',
  "order"      INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  completed_at INTEGER
);

CREATE TABLE IF NOT EXISTS projects (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  icon        TEXT NOT NULL DEFAULT '📁',
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS project_items (
  id           TEXT PRIMARY KEY,
  project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_id    TEXT REFERENCES project_items(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'TODO',
  "order"      INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  completed_at INTEGER
);
CREATE INDEX IF NOT EXISTS project_items_project_idx ON project_items(project_id);
CREATE INDEX IF NOT EXISTS project_items_parent_idx ON project_items(parent_id);
`;
```

`order` va entrecomillado porque es palabra reservada de SQL.

- [ ] **Paso 3: Crear la conexión**

`src/modules/core/db/index.ts`. Mismo patrón que `legacy/voidtify/src/db/index.ts`.

```ts
import "server-only";
import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { SCHEMA_SQL } from "./schema-sql";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "juampi.db");

function createDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.exec(SCHEMA_SQL);

  return drizzle(sqlite, { schema });
}

declare global {
  var __juampiDb: ReturnType<typeof createDb> | undefined;
}

// Singleton por proceso: evita abrir una conexión nueva en cada recarga de HMR.
export const db = globalThis.__juampiDb ?? (globalThis.__juampiDb = createDb());

export type Db = typeof db;
```

- [ ] **Paso 4: Instalar `server-only`**

```bash
npm install server-only
npx tsc --noEmit
```

Esperado: sin errores.

- [ ] **Paso 5: Commit**

```bash
git add src/modules/core/db package.json package-lock.json
git commit -m "feat(core): conexión única a SQLite con auto-creación de tablas"
```

---

### Tarea 8: Base en memoria para los tests

**Files:**
- Create: `src/modules/core/db/testing.ts`
- Test: `src/modules/core/db/testing.test.ts`

Los tests no pueden usar `src/modules/core/db/index.ts`: tiene `server-only` y escribe en disco. Esta es su alternativa.

- [ ] **Paso 1: Escribir el test que falla**

`src/modules/core/db/testing.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createTestDb } from "./testing";
import { habits } from "@/modules/habitos/schema";

describe("createTestDb", () => {
  it("crea las tablas y permite insertar y leer", async () => {
    const db = createTestDb();
    const now = new Date("2026-07-27T12:00:00Z");

    await db.insert(habits).values({
      id: "h1",
      name: "Leer 30 minutos",
      createdAt: now,
    });

    const rows = await db.select().from(habits);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Leer 30 minutos");
    // Los valores por defecto del esquema se aplican.
    expect(rows[0].icon).toBe("star");
    expect(rows[0].schedule).toBe("1111111");
    // mode: "boolean" devuelve un booleano, no 0/1.
    expect(rows[0].isAnchor).toBe(false);
    // mode: "timestamp_ms" devuelve un Date, no un número.
    expect(rows[0].createdAt).toBeInstanceOf(Date);
    expect(rows[0].createdAt.getTime()).toBe(now.getTime());
  });

  it("aísla cada instancia", async () => {
    const a = createTestDb();
    const b = createTestDb();
    await a.insert(habits).values({ id: "x", name: "solo en A", createdAt: new Date() });

    expect(await a.select().from(habits)).toHaveLength(1);
    expect(await b.select().from(habits)).toHaveLength(0);
  });
});
```

- [ ] **Paso 2: Ejecutar el test y comprobar que falla**

```bash
npx vitest run src/modules/core/db/testing.test.ts
```

Esperado: FAIL — no encuentra el módulo `./testing`.

- [ ] **Paso 3: Escribir la implementación mínima**

`src/modules/core/db/testing.ts`:

```ts
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { SCHEMA_SQL } from "./schema-sql";
import type { Db } from "./index";

/**
 * Base SQLite en memoria, aislada por llamada. Para tests: no toca el disco y
 * desaparece al terminar. Comparte SCHEMA_SQL con la de producción, así que si
 * el esquema real se rompe, los tests se enteran.
 */
export function createTestDb(): Db {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(SCHEMA_SQL);
  return drizzle(sqlite, { schema });
}
```

El tipo de retorno es `Db` a propósito: es el mismo que reciben las funciones de `lib/`, así que si divergieran, `tsc` avisa. `import type` no arrastra el `server-only` de `index.ts` al bundle de test — se borra al compilar. Si aun así vitest se queja de `server-only`, mueve `export type Db` a un archivo `types.ts` sin efectos secundarios e impórtalo desde los dos lados.

- [ ] **Paso 4: Ejecutar el test y comprobar que pasa**

```bash
npx vitest run src/modules/core/db/testing.test.ts
```

Esperado: PASS, 2 tests.

Si falla en `isAnchor` devolviendo `0` en lugar de `false`, revisa que el esquema use `{ mode: "boolean" }`. Si falla en `createdAt` devolviendo un número, revisa `{ mode: "timestamp_ms" }`.

- [ ] **Paso 5: Commit**

```bash
git add src/modules/core/db/testing.ts src/modules/core/db/testing.test.ts
git commit -m "test(core): base en memoria para tests"
```

---

# Fase C · Migración de Untap

### Tarea 9: Mover los archivos puros de `lib/`

Estos 19 archivos no tocan la base. Se mueven sin tocar una línea. Incluye los 7 de test, cuyas expectativas **no deben cambiar** en todo el plan.

**Files:**
- Move: 19 archivos de `legacy/untap/src/lib/` a `src/modules/habitos/lib/`

- [ ] **Paso 1: Mover**

```bash
cd "/c/PROYECTO JUAMPI"
mkdir -p src/modules/habitos/lib
for f in chart chart.test color color.test day day.test events flow flow.test \
         garden garden.test level metrics metrics.test sound streak streak.test useLocalHour; do
  git mv "legacy/untap/src/lib/$f.ts" "src/modules/habitos/lib/$f.ts"
done
ls src/modules/habitos/lib | wc -l
```

Esperado: `19`.

- [ ] **Paso 2: Ejecutar los tests**

```bash
npx vitest run
```

Esperado: PASS. Los 7 archivos de test se importan entre sí con rutas relativas (`./day`, `./streak`), así que moverlos juntos no rompe nada. Más el test de la Tarea 8: 8 archivos en verde.

Si algún test falla aquí, **detente**: significa que el movimiento rompió algo y hay que arreglarlo antes de seguir. No sigas con la migración sobre una base roja.

- [ ] **Paso 3: Commit**

```bash
git add -A src/modules/habitos/lib legacy/untap
git commit -m "refactor(habitos): mover los archivos puros de lib sin cambios"
```

---

### Tarea 10: Mover los componentes

**Files:**
- Move: 33 componentes a `src/modules/habitos/components/`, 6 a `src/modules/core/ui/`, 2 a `src/modules/core/shell/`

- [ ] **Paso 1: Mover lo compartido a `core`**

```bash
cd "/c/PROYECTO JUAMPI"
mkdir -p src/modules/core/ui src/modules/core/shell
git mv legacy/untap/src/components/ui/*    src/modules/core/ui/
git mv legacy/untap/src/components/shell/* src/modules/core/shell/
ls src/modules/core/ui src/modules/core/shell
```

Esperado: `Button.tsx Card.tsx Field.tsx Modal.tsx PageHeader.tsx Stat.tsx` y `AppShell.tsx NavIcons.tsx`.

- [ ] **Paso 2: Mover los componentes de dominio**

```bash
mkdir -p src/modules/habitos/components
git mv legacy/untap/src/components/* src/modules/habitos/components/
find src/modules/habitos/components -name "*.tsx" | wc -l
```

Esperado: `33`.

`charts/` y `ConfirmDialog` se quedan en `habitos/` de momento. Si el sub-proyecto 2 demuestra que Voidtify también los necesita, suben a `core/` entonces — no antes.

- [ ] **Paso 3: Corregir los imports**

Los componentes se importan entre sí con el alias `@/components/...`, que ya no existe. Sustituye en todos los archivos movidos:

| Antes | Después |
|---|---|
| `@/components/ui/X` | `@/modules/core/ui/X` |
| `@/components/shell/X` | `@/modules/core/shell/X` |
| `@/components/X` | `@/modules/habitos/components/X` |
| `@/lib/X` | `@/modules/habitos/lib/X` |

Hazlo con reemplazo en los archivos de `src/`. **Cuida el orden**: sustituye primero `@/components/ui/` y `@/components/shell/`, y solo después el genérico `@/components/`. Al revés, el genérico se come a los específicos y quedan rutas rotas.

```bash
cd "/c/PROYECTO JUAMPI"
files=$(find src -name "*.ts" -o -name "*.tsx")
sed -i 's|@/components/ui/|@/modules/core/ui/|g'       $files
sed -i 's|@/components/shell/|@/modules/core/shell/|g' $files
sed -i 's|@/components/|@/modules/habitos/components/|g' $files
sed -i 's|@/lib/|@/modules/habitos/lib/|g'             $files
grep -rn "@/components/\|@/lib/" src || echo "SIN IMPORTS VIEJOS"
```

Esperado: `SIN IMPORTS VIEJOS`.

- [ ] **Paso 4: Verificar**

```bash
npx vitest run
```

Esperado: PASS, igual que en la Tarea 9. `tsc` todavía dará errores porque los componentes importan de `@/modules/habitos/lib/habits` y funciones que aún no están migradas; es lo esperado hasta la Tarea 16.

- [ ] **Paso 5: Commit**

```bash
git add -A src legacy/untap
git commit -m "refactor(habitos): mover componentes a modules y corregir imports"
```

---

### Tarea 11: El patrón de traducción, con `tasks.ts`

`tasks.ts` es el archivo con acceso a datos más pequeño (97 líneas, 3 llamadas). Se migra primero para fijar el patrón que usarán las cinco tareas siguientes.

**Files:**
- Create: `src/modules/habitos/lib/tasks.ts`
- Test: `src/modules/habitos/lib/tasks.test.ts`
- Read: `legacy/untap/src/lib/tasks.ts`

- [ ] **Paso 1: Leer el original**

```bash
cat legacy/untap/src/lib/tasks.ts
```

Exporta `getTasksGrouped` y `getTaskMetrics`. Anota qué devuelve exactamente cada una: los tipos de retorno **no cambian**, solo cambia cómo se obtienen los datos.

- [ ] **Paso 2: Escribir el test que falla**

`src/modules/habitos/lib/tasks.test.ts`. Las funciones deben aceptar la base por parámetro para poder pasarles la de test; ese es el cambio de firma que introduce esta tarea.

```ts
import { describe, it, expect } from "vitest";
import { createTestDb } from "@/modules/core/db/testing";
import { tasks } from "@/modules/habitos/schema";
import { getTasksGrouped, getTaskMetrics } from "./tasks";

function makeTask(id: string, status: string, order = 0) {
  const now = new Date("2026-07-27T12:00:00Z");
  return { id, title: `tarea ${id}`, status, order, createdAt: now, updatedAt: now };
}

describe("getTasksGrouped", () => {
  it("agrupa por estado y respeta el orden", async () => {
    const db = createTestDb();
    await db.insert(tasks).values([
      makeTask("a", "TODO", 1),
      makeTask("b", "TODO", 0),
      makeTask("c", "IN_PROGRESS"),
      makeTask("d", "DONE"),
    ]);

    const grouped = await getTasksGrouped(db);

    expect(grouped.todo.map((t) => t.id)).toEqual(["b", "a"]);
    expect(grouped.inProgress.map((t) => t.id)).toEqual(["c"]);
    expect(grouped.done.map((t) => t.id)).toEqual(["d"]);
  });

  it("devuelve listas vacías sin tareas", async () => {
    const grouped = await getTasksGrouped(createTestDb());
    expect(grouped.todo).toEqual([]);
    expect(grouped.inProgress).toEqual([]);
    expect(grouped.done).toEqual([]);
  });
});

describe("getTaskMetrics", () => {
  it("cuenta las completadas frente al total", async () => {
    const db = createTestDb();
    await db.insert(tasks).values([
      makeTask("a", "TODO"),
      makeTask("b", "DONE"),
      makeTask("c", "DONE"),
    ]);

    const m = await getTaskMetrics(db);
    expect(m.total).toBe(3);
    expect(m.done).toBe(2);
  });
});
```

**Ajusta los nombres de las propiedades** (`grouped.todo`, `m.total`, `m.done`) a los que devuelve de verdad el original que leíste en el Paso 1. El test tiene que describir el comportamiento actual, no uno inventado.

- [ ] **Paso 3: Ejecutar y comprobar que falla**

```bash
npx vitest run src/modules/habitos/lib/tasks.test.ts
```

Esperado: FAIL — no encuentra `./tasks`.

- [ ] **Paso 4: Traducir el archivo**

Mueve el original y reescribe sus consultas:

```bash
git mv legacy/untap/src/lib/tasks.ts src/modules/habitos/lib/tasks.ts
```

Aplica esta tabla de equivalencias:

| Prisma | Drizzle |
|---|---|
| `prisma.task.findMany({ where: { status: "DONE" } })` | `db.select().from(tasks).where(eq(tasks.status, "DONE"))` |
| `orderBy: { order: "asc" }` | `.orderBy(asc(tasks.order))` |
| `orderBy: [{ a: "desc" }, { b: "asc" }]` | `.orderBy(desc(tasks.a), asc(tasks.b))` |
| `findUnique({ where: { id } })` | `db.select().from(tasks).where(eq(tasks.id, id)).limit(1)` → toma `[0]` |
| `findFirst({ orderBy: ... })` | igual, con `.limit(1)` |
| `count({ where: W })` | `db.select({ n: count() }).from(tasks).where(W)` → `[0].n` |
| `create({ data: D })` | `db.insert(tasks).values(D)` |
| `update({ where: { id }, data: D })` | `db.update(tasks).set(D).where(eq(tasks.id, id))` |
| `updateMany({ where: W, data: D })` | `db.update(tasks).set(D).where(W)` |
| `delete({ where: { id } })` | `db.delete(tasks).where(eq(tasks.id, id))` |
| `upsert({ where, create, update })` | `db.insert(t).values(C).onConflictDoUpdate({ target: t.id, set: U })` |

Imports necesarios: `import { and, asc, count, desc, eq, gte, inArray, lt } from "drizzle-orm";`

Tres cosas que Prisma hacía sola y ahora son tuyas:

1. **`@updatedAt`**: pon `updatedAt: new Date()` a mano en cada `insert` y cada `update`.
2. **`@default(cuid())`**: genera el id en la aplicación. Usa `crypto.randomUUID()`.
3. **Valores por defecto en `insert`**: los declarados en el esquema se aplican solos, no hace falta repetirlos.

Cambia la firma para recibir la base:

```ts
import type { Db } from "@/modules/core/db";

export async function getTasksGrouped(database: Db) { /* ... */ }
```

- [ ] **Paso 5: Ejecutar y comprobar que pasa**

```bash
npx vitest run src/modules/habitos/lib/tasks.test.ts
```

Esperado: PASS.

- [ ] **Paso 6: Comprobar que no se rompió nada**

```bash
npx vitest run
```

Esperado: todo verde.

- [ ] **Paso 7: Commit**

```bash
git add -A src legacy/untap
git commit -m "refactor(habitos): migrar tasks.ts a Drizzle"
```

---

### Tarea 12: `habits.ts` — el caso relacional

360 líneas, 7 llamadas. Es el archivo más delicado porque usa `include` y `_count`, que Drizzle no tiene sin la API relacional.

**Files:**
- Create: `src/modules/habitos/lib/habits.ts`
- Test: `src/modules/habitos/lib/habits.test.ts`
- Read: `legacy/untap/src/lib/habits.ts`

- [ ] **Paso 1: Entender la consulta relacional**

El original hace, en `getHabitsWithTodayStatus`:

```ts
const habits = await prisma.habit.findMany({
  orderBy: [{ isAnchor: "desc" }, { createdAt: "asc" }],
  include: {
    logs: { where: { date: { gte: cutoff } }, orderBy: { date: "desc" } },
    _count: { select: { logs: true } },
  },
});
```

**La trampa:** `logs` viene filtrado por `date >= cutoff` (400 días), pero `_count.logs` cuenta **todos** los registros, sin filtro. El código lo usa para `hasEverBeenDone`. Si lo calculas como `logs.length` sobre la lista filtrada, un hábito cumplido solo hace más de 400 días pasa a figurar como nunca cumplido, y la escena del jardín lo dibuja como semilla. Es un fallo silencioso: nada peta, solo miente. Necesitas **una consulta de conteo aparte, sin filtro de fecha**.

- [ ] **Paso 2: Escribir el test que falla**

`src/modules/habitos/lib/habits.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createTestDb } from "@/modules/core/db/testing";
import { habits, habitLogs } from "@/modules/habitos/schema";
import { getHabitsWithTodayStatus, getOrCreatePlayer } from "./habits";

const T0 = new Date("2020-01-01T12:00:00Z");

async function seed(db: ReturnType<typeof createTestDb>) {
  await db.insert(habits).values([
    { id: "h1", name: "Leer", isAnchor: false, createdAt: T0 },
    { id: "h2", name: "Agua", isAnchor: true, createdAt: T0 },
  ]);
}

describe("getHabitsWithTodayStatus", () => {
  it("pone el hábito ancla primero", async () => {
    const db = createTestDb();
    await seed(db);

    const rows = await getHabitsWithTodayStatus(db);

    expect(rows.map((h) => h.id)).toEqual(["h2", "h1"]);
  });

  it("marca hasEverBeenDone aunque el único registro esté fuera de la ventana", async () => {
    const db = createTestDb();
    await seed(db);
    // Muy anterior al corte de 400 días: fuera de la ventana de rachas,
    // pero el hábito SÍ se cumplió alguna vez.
    await db.insert(habitLogs).values({
      id: "l1",
      habitId: "h1",
      date: new Date("2021-01-01T00:00:00Z"),
      createdAt: T0,
    });

    const h1 = (await getHabitsWithTodayStatus(db)).find((h) => h.id === "h1")!;

    expect(h1.hasEverBeenDone).toBe(true);
    expect(h1.streak).toBe(0);
  });

  it("no marca hasEverBeenDone sin ningún registro", async () => {
    const db = createTestDb();
    await seed(db);

    const h1 = (await getHabitsWithTodayStatus(db)).find((h) => h.id === "h1")!;

    expect(h1.hasEverBeenDone).toBe(false);
  });
});

describe("getOrCreatePlayer", () => {
  it("crea el jugador por defecto la primera vez", async () => {
    const db = createTestDb();
    const p = await getOrCreatePlayer(db);
    expect(p.id).toBe("default");
    expect(p.xp).toBe(0);
    expect(p.shields).toBe(2);
  });

  it("devuelve el mismo jugador la segunda vez, sin duplicar", async () => {
    const db = createTestDb();
    await getOrCreatePlayer(db);
    await getOrCreatePlayer(db);
    expect(await db.select().from(player)).toHaveLength(1);
  });
});
```

Añade `player` a los imports del esquema para el último test.

- [ ] **Paso 3: Ejecutar y comprobar que falla**

```bash
npx vitest run src/modules/habitos/lib/habits.test.ts
```

Esperado: FAIL — no encuentra `./habits`.

- [ ] **Paso 4: Traducir**

```bash
git mv legacy/untap/src/lib/habits.ts src/modules/habitos/lib/habits.ts
```

Sustituye la consulta relacional por tres consultas y una agrupación en JavaScript:

```ts
import { and, asc, count, desc, eq, gte, inArray } from "drizzle-orm";
import { habits as habitsTable, habitLogs } from "@/modules/habitos/schema";
import type { Db } from "@/modules/core/db";

export async function getHabitsWithTodayStatus(
  database: Db,
): Promise<HabitWithStatus[]> {
  const today = dayKey();
  const cutoff = addDays(today, -STREAK_LOOKBACK_DAYS);

  const rows = await database
    .select()
    .from(habitsTable)
    .orderBy(desc(habitsTable.isAnchor), asc(habitsTable.createdAt));

  const ids = rows.map((h) => h.id);

  // Sin hábitos no hay nada que consultar, y un inArray con lista vacía
  // genera SQL inválido en SQLite.
  const logs = ids.length
    ? await database
        .select()
        .from(habitLogs)
        .where(and(inArray(habitLogs.habitId, ids), gte(habitLogs.date, cutoff)))
        .orderBy(desc(habitLogs.date))
    : [];

  // Conteo total SIN filtro de fecha: equivale al _count de Prisma.
  const totals = ids.length
    ? await database
        .select({ habitId: habitLogs.habitId, n: count() })
        .from(habitLogs)
        .where(inArray(habitLogs.habitId, ids))
        .groupBy(habitLogs.habitId)
    : [];

  const logsByHabit = new Map<string, typeof logs>();
  for (const l of logs) {
    const list = logsByHabit.get(l.habitId);
    if (list) list.push(l);
    else logsByHabit.set(l.habitId, [l]);
  }

  const totalByHabit = new Map(totals.map((t) => [t.habitId, t.n]));

  return rows.map((h) => {
    const habitLogsList = logsByHabit.get(h.id) ?? [];
    const hasEverBeenDone = (totalByHabit.get(h.id) ?? 0) > 0;
    // ...el resto del cuerpo del map se queda EXACTAMENTE como estaba,
    // sustituyendo h.logs por habitLogsList y h._count.logs por hasEverBeenDone.
  });
}
```

El resto de las funciones del archivo (`getPlayerLevelInfo`, `getHabitMonth`, `getHabitDiagnosis`) usan consultas simples: aplica la tabla de equivalencias de la Tarea 11.

`getOrCreatePlayer` era un `upsert`:

```ts
export async function getOrCreatePlayer(database: Db): Promise<PlayerRow> {
  const now = new Date();
  await database
    .insert(player)
    .values({ id: "default", shieldsUpdated: now, createdAt: now, updatedAt: now })
    .onConflictDoNothing({ target: player.id });

  const [row] = await database.select().from(player).where(eq(player.id, "default")).limit(1);
  return row;
}
```

- [ ] **Paso 5: Ejecutar y comprobar que pasa**

```bash
npx vitest run src/modules/habitos/lib/habits.test.ts
npx vitest run
```

Esperado: ambos verdes.

- [ ] **Paso 6: Commit**

```bash
git add -A src legacy/untap
git commit -m "refactor(habitos): migrar habits.ts a Drizzle sin API relacional"
```

---

### Tarea 13: `quests.ts`

254 líneas, 9 llamadas, incluido un `upsert` y dos `updateMany`.

**Files:**
- Create: `src/modules/habitos/lib/quests.ts`
- Test: `src/modules/habitos/lib/quests.test.ts`
- Read: `legacy/untap/src/lib/quests.ts`

- [ ] **Paso 1: Leer el original y anotar las tres funciones**

```bash
cat legacy/untap/src/lib/quests.ts
```

`pickQuestsForDate` es pura: no la toques. `syncDailyQuests` y `getTodayQuests` acceden a la base.

- [ ] **Paso 2: Escribir el test que falla**

`src/modules/habitos/lib/quests.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createTestDb } from "@/modules/core/db/testing";
import { dailyQuests } from "@/modules/habitos/schema";
import { syncDailyQuests, getTodayQuests } from "./quests";

const DIA = new Date("2026-07-27T00:00:00Z");

describe("syncDailyQuests", () => {
  it("crea las misiones del día la primera vez", async () => {
    const db = createTestDb();
    await syncDailyQuests(db, DIA);

    const rows = await db.select().from(dailyQuests);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.date.getTime() === DIA.getTime())).toBe(true);
  });

  it("es idempotente: llamarla dos veces no duplica", async () => {
    const db = createTestDb();
    await syncDailyQuests(db, DIA);
    const primera = (await db.select().from(dailyQuests)).length;

    await syncDailyQuests(db, DIA);
    const segunda = (await db.select().from(dailyQuests)).length;

    expect(segunda).toBe(primera);
  });

  it("no borra el progreso ya conseguido al resincronizar", async () => {
    const db = createTestDb();
    await syncDailyQuests(db, DIA);
    const [q] = await db.select().from(dailyQuests).limit(1);
    await db.update(dailyQuests).set({ progress: 2 }).where(eq(dailyQuests.id, q.id));

    await syncDailyQuests(db, DIA);

    const [despues] = await db.select().from(dailyQuests).where(eq(dailyQuests.id, q.id));
    expect(despues.progress).toBe(2);
  });
});

describe("getTodayQuests", () => {
  it("devuelve solo las del día pedido", async () => {
    const db = createTestDb();
    await syncDailyQuests(db, DIA);
    await syncDailyQuests(db, new Date("2026-07-28T00:00:00Z"));

    const hoy = await getTodayQuests(db, DIA);

    expect(hoy.every((q) => q.date.getTime() === DIA.getTime())).toBe(true);
  });
});
```

Importa `eq` de `drizzle-orm`. **Ajusta las firmas** (`syncDailyQuests(db, fecha)`) a las del original: si hoy no recibe fecha y usa `dayKey()` por dentro, añádele el parámetro con valor por defecto para poder testearla.

El tercer test es el importante: `onConflictDoUpdate` mal escrito pisa el progreso del día y el usuario pierde misiones ya cumplidas.

- [ ] **Paso 3: Ejecutar y comprobar que falla**

```bash
npx vitest run src/modules/habitos/lib/quests.test.ts
```

Esperado: FAIL — no encuentra `./quests`.

- [ ] **Paso 4: Traducir**

```bash
git mv legacy/untap/src/lib/quests.ts src/modules/habitos/lib/quests.ts
```

Aplica la tabla de la Tarea 11. Para el `upsert` sobre `(date, kind)`, el `target` es el par de columnas del índice único:

```ts
await database
  .insert(dailyQuests)
  .values({ id: crypto.randomUUID(), date, kind, target, xpReward })
  .onConflictDoNothing({ target: [dailyQuests.date, dailyQuests.kind] });
```

`onConflictDoNothing`, no `onConflictDoUpdate`: resincronizar no debe tocar lo que ya existe.

- [ ] **Paso 5: Ejecutar y comprobar que pasa**

```bash
npx vitest run src/modules/habitos/lib/quests.test.ts
npx vitest run
```

Esperado: ambos verdes.

- [ ] **Paso 6: Commit**

```bash
git add -A src legacy/untap
git commit -m "refactor(habitos): migrar quests.ts a Drizzle"
```

---

### Tarea 14: `projects.ts`

169 líneas, 4 llamadas. El árbol de subtareas es autorreferencial.

**Files:**
- Create: `src/modules/habitos/lib/projects.ts`
- Test: `src/modules/habitos/lib/projects.test.ts`
- Read: `legacy/untap/src/lib/projects.ts`

- [ ] **Paso 1: Leer el original**

```bash
cat legacy/untap/src/lib/projects.ts
```

`movementOf` es pura. `listProjects`, `getProjectWithTree` y `getProjectMetrics` acceden a la base.

- [ ] **Paso 2: Escribir el test que falla**

`src/modules/habitos/lib/projects.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createTestDb } from "@/modules/core/db/testing";
import { projects, projectItems } from "@/modules/habitos/schema";
import { getProjectWithTree, getProjectMetrics } from "./projects";

const T0 = new Date("2026-07-27T12:00:00Z");

async function seedArbol(db: ReturnType<typeof createTestDb>) {
  await db.insert(projects).values({ id: "p1", name: "Proyecto", createdAt: T0, updatedAt: T0 });
  await db.insert(projectItems).values([
    { id: "raiz", projectId: "p1", parentId: null, title: "Raíz", status: "TODO", order: 0, createdAt: T0, updatedAt: T0 },
    { id: "hijo", projectId: "p1", parentId: "raiz", title: "Hijo", status: "DONE", order: 0, createdAt: T0, updatedAt: T0 },
    { id: "nieto", projectId: "p1", parentId: "hijo", title: "Nieto", status: "DONE", order: 0, createdAt: T0, updatedAt: T0 },
  ]);
}

describe("getProjectWithTree", () => {
  it("anida los hijos bajo su padre", async () => {
    const db = createTestDb();
    await seedArbol(db);

    const proyecto = await getProjectWithTree(db, "p1");

    expect(proyecto!.items).toHaveLength(1);
    expect(proyecto!.items[0].id).toBe("raiz");
    expect(proyecto!.items[0].children[0].id).toBe("hijo");
    expect(proyecto!.items[0].children[0].children[0].id).toBe("nieto");
  });

  it("devuelve null si el proyecto no existe", async () => {
    expect(await getProjectWithTree(createTestDb(), "no-existe")).toBeNull();
  });
});

describe("getProjectMetrics", () => {
  it("cuenta los descendientes completados de forma recursiva", async () => {
    const db = createTestDb();
    await seedArbol(db);

    const m = await getProjectMetrics(db, "p1");

    expect(m.total).toBe(3);
    expect(m.done).toBe(2);
  });
});
```

**Ajusta los nombres** (`items`, `children`, `total`, `done`) a los que devuelve el original.

- [ ] **Paso 3: Ejecutar y comprobar que falla**

```bash
npx vitest run src/modules/habitos/lib/projects.test.ts
```

Esperado: FAIL — no encuentra `./projects`.

- [ ] **Paso 4: Traducir**

```bash
git mv legacy/untap/src/lib/projects.ts src/modules/habitos/lib/projects.ts
```

El árbol se arma con una sola consulta plana y agrupación en memoria — no consultes por nivel, sería N+1:

```ts
const flat = await database
  .select()
  .from(projectItems)
  .where(eq(projectItems.projectId, projectId))
  .orderBy(asc(projectItems.order));

const byParent = new Map<string | null, typeof flat>();
for (const item of flat) {
  const list = byParent.get(item.parentId);
  if (list) list.push(item);
  else byParent.set(item.parentId, [item]);
}

function build(parentId: string | null): TreeItem[] {
  return (byParent.get(parentId) ?? []).map((item) => ({
    ...item,
    children: build(item.id),
  }));
}

const items = build(null);
```

- [ ] **Paso 5: Ejecutar y comprobar que pasa**

```bash
npx vitest run src/modules/habitos/lib/projects.test.ts
npx vitest run
```

Esperado: ambos verdes.

- [ ] **Paso 6: Commit**

```bash
git add -A src legacy/untap
git commit -m "refactor(habitos): migrar projects.ts a Drizzle"
```

---

### Tarea 15: `stats.ts` y `home.ts`

172 y 138 líneas, 3 y 2 llamadas. Ambos son de solo lectura y agregan datos que ya cubren los tests puros de `metrics.test.ts`.

**Files:**
- Create: `src/modules/habitos/lib/stats.ts`, `src/modules/habitos/lib/home.ts`
- Test: `src/modules/habitos/lib/stats.test.ts`
- Read: `legacy/untap/src/lib/stats.ts`, `legacy/untap/src/lib/home.ts`

- [ ] **Paso 1: Leer los dos originales**

```bash
cat legacy/untap/src/lib/stats.ts legacy/untap/src/lib/home.ts
```

`weekdayName` y `weekdayFullName` son puras. Las que tocan la base son `getHabitStats`, `getGlobalStats` y `getHomeMetrics`.

- [ ] **Paso 2: Escribir el test que falla**

`src/modules/habitos/lib/stats.test.ts`. Un solo test por función: la lógica de cálculo ya está cubierta por `metrics.test.ts`, así que aquí solo se verifica que los datos llegan bien desde la base.

```ts
import { describe, it, expect } from "vitest";
import { createTestDb } from "@/modules/core/db/testing";
import { habits, habitLogs } from "@/modules/habitos/schema";
import { getGlobalStats } from "./stats";

const T0 = new Date("2026-07-27T12:00:00Z");

describe("getGlobalStats", () => {
  it("agrega los registros de todos los hábitos", async () => {
    const db = createTestDb();
    await db.insert(habits).values([
      { id: "h1", name: "Leer", createdAt: T0 },
      { id: "h2", name: "Agua", createdAt: T0 },
    ]);
    await db.insert(habitLogs).values([
      { id: "l1", habitId: "h1", date: T0, createdAt: T0 },
      { id: "l2", habitId: "h2", date: T0, createdAt: T0 },
    ]);

    const s = await getGlobalStats(db);

    expect(s.totalLogs).toBe(2);
  });

  it("no revienta con la base vacía", async () => {
    const s = await getGlobalStats(createTestDb());
    expect(s.totalLogs).toBe(0);
  });
});
```

**Ajusta `totalLogs`** al nombre real que devuelve `getGlobalStats`. El segundo test importa: las funciones de agregación son las que suelen romperse con cero filas.

- [ ] **Paso 3: Ejecutar y comprobar que falla**

```bash
npx vitest run src/modules/habitos/lib/stats.test.ts
```

Esperado: FAIL — no encuentra `./stats`.

- [ ] **Paso 4: Traducir los dos archivos**

```bash
git mv legacy/untap/src/lib/stats.ts src/modules/habitos/lib/stats.ts
git mv legacy/untap/src/lib/home.ts  src/modules/habitos/lib/home.ts
```

Aplica la tabla de la Tarea 11. Cuidado con los agregados sobre tabla vacía: `count()` devuelve `0`, pero `sum()` devuelve `null`, no `0`. Usa `?? 0` en cualquier suma.

- [ ] **Paso 5: Ejecutar y comprobar que pasa**

```bash
npx vitest run src/modules/habitos/lib/stats.test.ts
npx vitest run
```

Esperado: ambos verdes.

- [ ] **Paso 6: Commit**

```bash
git add -A src legacy/untap
git commit -m "refactor(habitos): migrar stats.ts y home.ts a Drizzle"
```

---

### Tarea 16: Los server actions

600 líneas, 33 llamadas — más de la mitad de toda la superficie. Se hace en dos pasadas para que cada commit sea revisable.

**Files:**
- Create: `src/modules/habitos/actions.ts`
- Test: `src/modules/habitos/actions.test.ts`
- Read: `legacy/untap/src/app/actions.ts`

- [ ] **Paso 1: Leer el original entero**

```bash
cat legacy/untap/src/app/actions.ts
```

Son 18 funciones. Nueve de hábitos (`toggleToday`, `toggleHabitOnDay`, `createHabit`, `setHabitAnchor`, `updateHabitSchedule`, `updateHabitIntention`, `deleteHabit`, `fetchHabitMonth`, `fetchHabitStats`) y nueve de tareas y proyectos.

- [ ] **Paso 2: Escribir el test que falla**

`src/modules/habitos/actions.test.ts`. Este es el test de ciclo completo que pide el spec: crear hábito → marcarlo → comprobar XP y racha.

```ts
import { describe, it, expect } from "vitest";
import { createTestDb } from "@/modules/core/db/testing";
import { habits, habitLogs, player } from "@/modules/habitos/schema";
import { eq } from "drizzle-orm";
import { toggleHabitOnDay, createHabit } from "./actions";

const HOY = new Date("2026-07-27T00:00:00Z");

describe("ciclo completo de un hábito", () => {
  it("crear, marcar y desmarcar deja el XP en cero", async () => {
    const db = createTestDb();

    await createHabit(db, { name: "Leer 30 minutos" });
    const [h] = await db.select().from(habits);
    expect(h.name).toBe("Leer 30 minutos");

    await toggleHabitOnDay(db, h.id, HOY);

    const logs = await db.select().from(habitLogs).where(eq(habitLogs.habitId, h.id));
    expect(logs).toHaveLength(1);

    const [p1] = await db.select().from(player);
    expect(p1.xp).toBeGreaterThan(0);
    const xpGanado = p1.xp;
    expect(logs[0].xpAwarded).toBe(xpGanado);

    // Desmarcar devuelve exactamente el XP concedido: marcar/desmarcar suma cero.
    await toggleHabitOnDay(db, h.id, HOY);

    expect(await db.select().from(habitLogs).where(eq(habitLogs.habitId, h.id))).toHaveLength(0);
    const [p2] = await db.select().from(player);
    expect(p2.xp).toBe(0);
  });

  it("marcar dos veces el mismo día no duplica el registro", async () => {
    const db = createTestDb();
    await createHabit(db, { name: "Agua" });
    const [h] = await db.select().from(habits);

    await toggleHabitOnDay(db, h.id, HOY);
    await toggleHabitOnDay(db, h.id, HOY);
    await toggleHabitOnDay(db, h.id, HOY);

    const logs = await db.select().from(habitLogs).where(eq(habitLogs.habitId, h.id));
    // Tres toggles = marcado, desmarcado, marcado.
    expect(logs).toHaveLength(1);
  });

  it("borrar un hábito arrastra sus registros", async () => {
    const db = createTestDb();
    await createHabit(db, { name: "Curso" });
    const [h] = await db.select().from(habits);
    await toggleHabitOnDay(db, h.id, HOY);

    await db.delete(habits).where(eq(habits.id, h.id));

    expect(await db.select().from(habitLogs)).toHaveLength(0);
  });
});
```

El tercer test verifica que `foreign_keys = ON` y el `ON DELETE CASCADE` están de verdad activos. Sin ese pragma, SQLite ignora las claves foráneas en silencio y quedan registros huérfanos.

**Ajusta las firmas** de `createHabit` y `toggleHabitOnDay` a las del original, añadiéndoles el parámetro de base.

- [ ] **Paso 3: Ejecutar y comprobar que falla**

```bash
npx vitest run src/modules/habitos/actions.test.ts
```

Esperado: FAIL — no encuentra `./actions`.

- [ ] **Paso 4: Traducir las nueve funciones de hábitos**

```bash
git mv legacy/untap/src/app/actions.ts src/modules/habitos/actions.ts
```

Mantén `"use server"` en la primera línea. Aplica la tabla de la Tarea 11.

Dos avisos:

- **`revalidatePath`**: las rutas cambian a español en la Tarea 17. Por ahora deja las que hay; se corrigen allí.
- **Transacciones**: donde el original encadenaba escrituras dependientes (crear el registro y actualizar el XP del jugador), envuélvelo en `database.transaction((tx) => { ... })`. Si falla a medias, el XP y el registro quedan descuadrados y el usuario ve un número que no le corresponde.

- [ ] **Paso 5: Ejecutar los tests de hábitos**

```bash
npx vitest run src/modules/habitos/actions.test.ts
```

Esperado: PASS.

- [ ] **Paso 6: Commit parcial**

```bash
git add -A src legacy/untap
git commit -m "refactor(habitos): migrar los server actions de hábitos a Drizzle"
```

- [ ] **Paso 7: Traducir las nueve de tareas y proyectos**

Mismo procedimiento sobre el resto del archivo: `createTask`, `updateTaskStatus`, `deleteTask`, `createProject`, `deleteProject`, `createProjectItem`, `updateProjectItemStatus`, `deleteProjectItem`, `renameProjectItem`.

- [ ] **Paso 8: Verificar y commitear**

```bash
npx vitest run
npx tsc --noEmit
git add -A src legacy/untap
git commit -m "refactor(habitos): migrar los server actions de tareas y proyectos"
```

Esperado: tests verdes. `tsc` puede seguir quejándose de las páginas, que aún no se han movido.

---

# Fase D · Rutas, portada y cierre

### Tarea 17: Las rutas en español

**Files:**
- Create: `src/app/layout.tsx`, `src/app/globals.css`, `src/app/{habitos,tareas,proyectos,jardin}/page.tsx`, `src/app/proyectos/[id]/page.tsx`
- Create: `src/modules/habitos/index.ts`

- [ ] **Paso 1: Mover los estilos y el layout**

```bash
cd "/c/PROYECTO JUAMPI"
mkdir -p src/app
git mv legacy/untap/src/app/globals.css src/app/globals.css
git mv legacy/untap/src/app/error.tsx   src/app/error.tsx
git mv legacy/untap/src/app/not-found.tsx src/app/not-found.tsx
git mv legacy/untap/src/app/favicon.ico src/app/favicon.ico
```

`globals.css` se mueve **sin tocar una línea**. Sus tokens llevan ratios de contraste medidos y documentados en los comentarios; recalcularlos es el sub-proyecto 4, no este.

- [ ] **Paso 2: Escribir el layout global**

`src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/modules/core/shell/AppShell";
import { AchievementToast } from "@/modules/habitos/components/AchievementToast";
import { SoundEffects } from "@/modules/habitos/components/SoundEffects";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Mis apps, hábitos y música en un solo sitio",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full">
      <body className="min-h-full">
        <AchievementToast />
        <SoundEffects />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
```

`AchievementToast` y `SoundEffects` son de hábitos y están en el layout global. Es una deuda consciente: cuando entre Voidtify en el sub-proyecto 2 habrá que decidir si suben a `core` o bajan a un layout de sección. Anótalo, no lo resuelvas ahora.

- [ ] **Paso 3: Mover las páginas a sus rutas en español**

```bash
mkdir -p src/app/habitos src/app/tareas src/app/proyectos/\[id\] src/app/jardin
git mv legacy/untap/src/app/habits/page.tsx       src/app/habitos/page.tsx
git mv legacy/untap/src/app/tasks/page.tsx        src/app/tareas/page.tsx
git mv legacy/untap/src/app/projects/page.tsx     src/app/proyectos/page.tsx
git mv "legacy/untap/src/app/projects/[id]/page.tsx" "src/app/proyectos/[id]/page.tsx"
git mv legacy/untap/src/app/garden/page.tsx       src/app/jardin/page.tsx
```

- [ ] **Paso 4: Crear la interfaz pública del módulo**

`src/modules/habitos/index.ts`. Esta es la regla de fronteras del spec hecha código: es lo único que `src/app` puede importar del módulo.

```ts
export {
  getHabitsWithTodayStatus,
  getOrCreatePlayer,
  getPlayerLevelInfo,
  getHabitMonth,
  getHabitDiagnosis,
} from "./lib/habits";
export { getHomeMetrics } from "./lib/home";
export { listProjects, getProjectWithTree, getProjectMetrics } from "./lib/projects";
export { getTodayQuests, syncDailyQuests } from "./lib/quests";
export { getHabitStats, getGlobalStats } from "./lib/stats";
export { getTasksGrouped, getTaskMetrics } from "./lib/tasks";
export * from "./actions";

export type { HabitWithStatus } from "./lib/habits";
```

- [ ] **Paso 5: Corregir rutas e imports en las páginas**

En los cinco `page.tsx`, en `AppShell.tsx` y en `actions.ts`:

| Antes | Después |
|---|---|
| `href="/habits"` | `href="/habitos"` |
| `href="/tasks"` | `href="/tareas"` |
| `href="/projects"` | `href="/proyectos"` |
| `href="/garden"` | `href="/jardin"` |
| `revalidatePath("/habits")` | `revalidatePath("/habitos")` |
| `from "@/app/actions"` | `from "@/modules/habitos"` |

Las páginas también deben pasar la base a las funciones, que ahora la reciben por parámetro:

```tsx
import { db } from "@/modules/core/db";
import { getHabitsWithTodayStatus } from "@/modules/habitos";

export default async function HabitosPage() {
  const habits = await getHabitsWithTodayStatus(db);
  // ...
}
```

- [ ] **Paso 6: Verificar que no quedan rutas viejas**

```bash
grep -rn '"/habits\|"/tasks\|"/projects\|"/garden' src && echo "QUEDAN RUTAS VIEJAS" || echo "LIMPIO"
npx tsc --noEmit
npx vitest run
```

Esperado: `LIMPIO`, `tsc` sin errores y tests verdes.

- [ ] **Paso 7: Commit**

```bash
git add -A src legacy/untap
git commit -m "feat: rutas en español y interfaz pública del módulo de hábitos"
```

---

### Tarea 18: La portada

**Files:**
- Create: `src/app/page.tsx`
- Read: `legacy/untap/src/app/page.tsx`

- [ ] **Paso 1: Leer la portada actual de Untap**

```bash
cat legacy/untap/src/app/page.tsx
```

107 líneas con métricas del día, misiones y tendencia. Ese contenido pasa a ser **una sección** de la portada nueva, no la portada entera.

- [ ] **Paso 2: Escribir la portada**

`src/app/page.tsx`. Dashboard mínimo pero real: la sección de hábitos con datos de verdad, y un hueco declarado para música.

```tsx
import Link from "next/link";
import { db } from "@/modules/core/db";
import { getHomeMetrics, getTodayQuests, syncDailyQuests } from "@/modules/habitos";
import { MetricTiles } from "@/modules/habitos/components/home/MetricTiles";
import { QuestList } from "@/modules/habitos/components/home/QuestList";

export default async function DashboardPage() {
  await syncDailyQuests(db);
  const [metrics, quests] = await Promise.all([
    getHomeMetrics(db),
    getTodayQuests(db),
  ]);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-10 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Hoy</h1>
        <p className="text-sm opacity-70">Todo en un solo sitio.</p>
      </header>

      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-medium">Hábitos</h2>
          <Link href="/habitos" className="text-sm underline opacity-70">
            Ver todo
          </Link>
        </div>
        <MetricTiles metrics={metrics} />
        <QuestList quests={quests} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Música</h2>
        <p className="rounded-lg border border-dashed p-6 text-sm opacity-60">
          Llega en el siguiente paso, cuando Voidtify entre en la app.
        </p>
      </section>
    </main>
  );
}
```

**Ajusta las props** de `MetricTiles` y `QuestList` a las que esperan de verdad; míralas en `src/modules/habitos/components/home/`.

El hueco de música es literal a propósito: deja visible qué falta en lugar de fingir que la portada está terminada.

- [ ] **Paso 3: Verificar en el navegador**

```bash
npm run dev
```

Abre `http://127.0.0.1:3000` y comprueba, uno por uno:

1. La portada carga y muestra las métricas de hábitos
2. `/habitos` lista los hábitos y se puede crear uno
3. Marcar un hábito suma XP y lanza el toast
4. `/jardin` dibuja la escena y la planta del hábito marcado
5. `/tareas` permite crear una tarea y moverla de columna
6. `/proyectos` permite crear un proyecto y una subtarea anidada
7. Desmarcar el hábito devuelve el XP al valor anterior

Si algo falla, arréglalo antes de commitear. Este es el criterio 5 del spec y no se da por bueno leyendo código: hay que verlo funcionar.

- [ ] **Paso 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: portada del dashboard con la sección de hábitos"
```

---

### Tarea 19: Purga de Prisma y verificación final

**Files:**
- Delete: `legacy/untap/` (lo que quede), `src/generated/`

- [ ] **Paso 1: Comprobar que no queda nada por migrar en `legacy/untap`**

```bash
cd "/c/PROYECTO JUAMPI"
find legacy/untap -type f -not -path "*/node_modules/*" -not -path "*/.next/*" | sort
```

Deben quedar solo archivos que ya no hacen falta: `prisma/schema.prisma`, `src/generated/`, `package.json`, `README.md`, `dev.db`, lockfiles. **Si aparece algún `.ts` o `.tsx` de `src/` que no reconozcas, míralo antes de borrar** — puede ser algo que se pasó por alto.

- [ ] **Paso 2: Rescatar el README**

Tiene la descripción completa de todas las funcionalidades y merece sobrevivir.

```bash
mkdir -p docs
git mv legacy/untap/README.md docs/untap-original.md
```

- [ ] **Paso 3: Borrar el resto**

```bash
git rm -r --quiet legacy/untap
ls legacy
```

Esperado: `portafolio  spotify-calificar  voidtify`. Untap ya no está: vive en `src/`.

- [ ] **Paso 4: Comprobar que no queda rastro de Prisma**

```bash
grep -rn "prisma\|Prisma" src package.json && echo "QUEDA PRISMA" || echo "LIMPIO"
ls src/generated 2>/dev/null && echo "QUEDA GENERATED" || echo "SIN GENERATED"
```

Esperado: `LIMPIO` y `SIN GENERATED`.

- [ ] **Paso 5: Verificación completa contra los criterios del spec**

```bash
cd "/c/PROYECTO JUAMPI"
npm run lint
npx tsc --noEmit
npm run test
npm run build
for sha in 9a9fe62 70f434b b2465fe 6aba138 518aef2; do git log -1 --format="%h %s" $sha; done
```

Esperado: los cuatro comandos en verde y los cinco SHA originales resolviendo a su mensaje de commit.

Si `npm run build` falla por `better-sqlite3`, revisa que `serverExternalPackages` esté en `next.config.ts`.

- [ ] **Paso 6: Commit final**

```bash
git add -A
git commit -m "chore: retirar Prisma y el andamiaje de legacy/untap"
git log --oneline | head -20
```

---

## Criterios de aceptación

Repasa los ocho del spec, cada uno con su comprobación:

- [ ] 1. Los SHA originales de los cuatro repos resuelven (`git log -1 9a9fe62` y compañía)
- [ ] 2. `npm run build` pasa
- [ ] 3. `npm run test` pasa — los 7 archivos migrados intactos más los 7 nuevos
- [ ] 4. `npm run lint` y `npx tsc --noEmit` limpios
- [ ] 5. Las cuatro pantallas funcionan en el navegador (los 7 puntos de la Tarea 18, Paso 3)
- [ ] 6. Cero rastro de Prisma en `package.json`; `src/generated/` eliminado
- [ ] 7. `/` existe con navegación a las secciones
- [ ] 8. Voidtify intacto en `legacy/voidtify/`, sin tocar

Verifica el 8 explícitamente:

```bash
find legacy/voidtify -newer package.json -type f -not -path "*/node_modules/*" | head
```

No debe devolver nada: si algún archivo de Voidtify se modificó durante este trabajo, se salió del alcance.

**Y no toques `C:\Voidtify`**, que es la instalación real y tiene 158 MB de datos que el sub-proyecto 2 debe migrar. Está fuera de este repo y fuera de este alcance.
