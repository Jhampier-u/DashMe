# Proyectos: lenguaje moderno y métricas de avance — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar `/projects` y `/projects/[id]` al lenguaje moderno y añadir el último movimiento por proyecto y el ritmo de avance semanal.

**Architecture:** Reutiliza todo lo que dejó montado el plan de Tareas: `lib/flow.ts`, `BarChart`, `Field`, `PageHeader` y el patrón de cabecera con formulario debajo. Solo se añade a `flow.ts` un `daysSince` con tests, y a `lib/projects.ts` las consultas.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript estricto, Prisma 7 sobre SQLite, Tailwind 4, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-27-tareas-proyectos-design.md` — segunda mitad.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/lib/flow.ts` (modificar) | Añade `daysSince` |
| `src/lib/flow.test.ts` (modificar) | Sus tests |
| `src/lib/projects.ts` (modificar) | Último movimiento en `listProjects`, y `getProjectMetrics` |
| `src/components/projects/ProjectCard.tsx` (nuevo) | Tarjeta moderna; sustituye a `components/ProjectCard.tsx` |
| `src/components/projects/NewProjectForm.tsx` (nuevo) | Formulario moderno; sustituye a `components/NewProjectForm.tsx` |
| `src/components/projects/ProjectsHeader.tsx` (nuevo) | Cabecera con el formulario debajo |
| `src/components/projects/AdvancePanel.tsx` (nuevo) | Ritmo de avance semanal |
| `src/components/projects/ProjectTree.tsx` (nuevo) | Raíz del árbol; sustituye a `ProjectTreeRoot.tsx` |
| `src/components/projects/ProjectTreeItem.tsx` (nuevo) | Nodo del árbol; sustituye al de `components/` |
| `src/app/projects/page.tsx` (reescribir) | Lista de proyectos |
| `src/app/projects/[id]/page.tsx` (reescribir) | Detalle |

**Un arreglo que entra de paso:** `components/ProjectCard.tsx` usa todavía el
`confirm()` del navegador para borrar, cuando el resto de la app ya usa el
diálogo propio. Se corrige al reescribirlo, porque es exactamente el código que
se está tocando.

---

### Task 1: daysSince

**Files:**
- Modify: `src/lib/flow.ts`
- Test: `src/lib/flow.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Ampliar el import existente de `./flow` en `src/lib/flow.test.ts` para incluir `daysSince`, y añadir al final del archivo:

```ts
describe("daysSince", () => {
  const hoy = key("2026-07-27");

  it("cuenta días de calendario desde el instante dado", () => {
    expect(daysSince(new Date("2026-07-20T23:00:00-05:00"), hoy)).toBe(7);
  });

  it("hoy mismo son cero días", () => {
    expect(daysSince(new Date("2026-07-27T08:00:00-05:00"), hoy)).toBe(0);
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npx vitest run src/lib/flow.test.ts`
Expected: FAIL — `daysSince` no existe.

- [ ] **Step 3: Implementar**

Añadir al final de `src/lib/flow.ts`:

```ts
/** Días de calendario transcurridos desde un instante hasta hoy. */
export function daysSince(moment: Date, today: Date = dayKey()): number {
  return daysBetween(today, dayKey(moment));
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npx vitest run src/lib/flow.test.ts`
Expected: PASS, 20 tests en ese archivo.

- [ ] **Step 5: Commit**

```bash
git add src/lib/flow.ts src/lib/flow.test.ts
git commit -m "Añade daysSince al módulo de flujo"
```

---

### Task 2: Consultas de proyectos

**Files:**
- Modify: `src/lib/projects.ts`

- [ ] **Step 1: Añadir el último movimiento a ProjectSummary**

`src/lib/projects.ts` ya importa `prisma` en su primera línea. Añadir junto a él:

```ts
import { dayKey } from "./day";
import {
  daysSince,
  periodChange,
  weeklyCounts,
  type PeriodChange,
  type WeekBucket,
} from "./flow";
```

Ampliar el tipo `ProjectSummary` con un campo más:

```ts
  /**
   * Días desde el último avance. `from` dice si se cuenta desde una subtarea
   * completada o, cuando no hay ninguna, desde la creación del proyecto: un
   * proyecto sin nada hecho no lleva "cero días parado".
   */
  lastMovement: { days: number; from: "completion" | "creation" };
```

Y sustituir el cuerpo de `listProjects` por este, que ahora también trae
`completedAt` de cada subtarea:

```ts
export async function listProjects(): Promise<ProjectSummary[]> {
  const today = dayKey();
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "asc" },
    include: { items: { select: { status: true, completedAt: true } } },
  });

  return projects.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    icon: p.icon,
    color: p.color,
    createdAt: p.createdAt,
    totalItems: p.items.length,
    doneItems: p.items.filter((i) => i.status === "DONE").length,
    lastMovement: movementOf(
      p.items.map((i) => i.completedAt),
      p.createdAt,
      today,
    ),
  }));
}
```

- [ ] **Step 2: Añadir las métricas de avance**

Añadir al final de `src/lib/projects.ts`:

```ts
/** Semanas que se pintan; se cargan el doble para poder comparar periodos. */
export const ADVANCE_WEEKS = 12;

export type ProjectMetrics = {
  weeks: WeekBucket[];
  change: PeriodChange;
};

/**
 * Días desde el último avance de un conjunto de subtareas. Se comparte entre
 * `listProjects` y `getProjectWithTree` para no calcularlo de dos maneras.
 */
export function movementOf(
  completions: (Date | null)[],
  createdAt: Date,
  today: Date,
): { days: number; from: "completion" | "creation" } {
  const done = completions.filter((d): d is Date => d !== null);
  if (done.length === 0) {
    return { days: daysSince(createdAt, today), from: "creation" };
  }
  const last = done.reduce((a, b) => (a > b ? a : b));
  return { days: daysSince(last, today), from: "completion" };
}

/** Ritmo de avance: subtareas completadas por semana, en todos los proyectos. */
export async function getProjectMetrics(): Promise<ProjectMetrics> {
  const today = dayKey();
  const items = await prisma.projectItem.findMany({
    where: { status: "DONE", completedAt: { not: null } },
    select: { completedAt: true },
  });

  const completions = items
    .map((i) => i.completedAt)
    .filter((d): d is Date => d !== null);

  const buckets = weeklyCounts(completions, ADVANCE_WEEKS * 2, today);
  return { weeks: buckets.slice(ADVANCE_WEEKS), change: periodChange(buckets) };
}
```

- [ ] **Step 3: Devolver el movimiento también en el detalle**

En `getProjectWithTree`, la consulta de `items` debe traer también `completedAt`
(añádelo al `select` si lo hay, o comprueba que ya viene), y el `return` debe
incluir el movimiento:

```ts
  return {
    project,
    roots,
    totalItems: total,
    doneItems: done,
    lastMovement: movementOf(
      items.map((i) => i.completedAt),
      project.createdAt,
      dayKey(),
    ),
  };
```

Esto evita que la pantalla de detalle tenga que llamar a `listProjects()` solo
para saber una fecha: eso cargaría todos los proyectos con todas sus subtareas
para usar un único dato.

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit && npx eslint && npx vitest run`
Expected: sin errores. Si falla, repórtalo antes de tocar nada más.

- [ ] **Step 5: Commit**

```bash
git add src/lib/projects.ts
git commit -m "Añade último movimiento y ritmo de avance a proyectos"
```

---

### Task 3: Tarjeta, formulario y cabecera

**Files:**
- Create: `src/components/projects/ProjectCard.tsx`
- Create: `src/components/projects/NewProjectForm.tsx`
- Create: `src/components/projects/ProjectsHeader.tsx`

- [ ] **Step 1: Crear la tarjeta**

Crear `src/components/projects/ProjectCard.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useTransition } from "react";
import { deleteProject } from "@/app/actions";
import { useConfirm } from "@/components/PixelConfirm";
import type { ProjectSummary } from "@/lib/projects";

/** Cuánto tiempo parado empieza a ser señal de aviso. */
const STALE_DAYS = 14;

export function ProjectCard({ project }: { project: ProjectSummary }) {
  const [pending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirm();

  const percent =
    project.totalItems === 0 ? 0 : project.doneItems / project.totalItems;
  const stale = project.lastMovement.days >= STALE_DAYS;

  async function remove(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const ok = await confirm({
      title: "Borrar proyecto",
      message: `Se borrará "${project.name}" y todas sus subtareas.`,
    });
    if (!ok) return;
    const fd = new FormData();
    fd.set("id", project.id);
    startTransition(() => deleteProject(fd));
  }

  const movement =
    project.lastMovement.from === "creation"
      ? project.lastMovement.days === 0
        ? "creado hoy, sin avances"
        : `sin avances desde que se creó, hace ${project.lastMovement.days} días`
      : project.lastMovement.days === 0
        ? "avanzaste hoy"
        : `último avance hace ${project.lastMovement.days} días`;

  return (
    <div
      className="m-card"
      style={{ padding: 16, opacity: pending ? 0.5 : 1, position: "relative" }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <span style={{ fontSize: 20 }} aria-hidden>
          {project.icon}
        </span>
        <Link
          href={`/projects/${project.id}`}
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 15,
            fontWeight: 600,
            color: "var(--m-ink)",
            textDecoration: "none",
          }}
        >
          {project.name}
        </Link>
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          style={{
            width: 24,
            height: 24,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 6,
            border: "1px solid var(--m-line)",
            background: "transparent",
            color: "var(--m-crit)",
            fontSize: 11,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
          aria-label={`Borrar el proyecto ${project.name}`}
        >
          ✕
        </button>
      </div>

      <p style={{ fontSize: 12.5, color: "var(--m-ink-2)", marginTop: 8, minHeight: 18 }}>
        {project.description ?? "Sin descripción"}
      </p>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 12,
          color: "var(--m-ink-3)",
          marginTop: 12,
          marginBottom: 6,
        }}
      >
        <span className="m-num">
          {project.doneItems} de {project.totalItems}
        </span>
        <span className="m-num">{Math.round(percent * 100)}%</span>
      </div>

      <div style={{ height: 5, background: "var(--m-track)", borderRadius: 3 }}>
        <div
          style={{
            height: "100%",
            width: `${Math.round(percent * 100)}%`,
            background: "var(--m-series)",
            borderRadius: 3,
          }}
        />
      </div>

      <div
        style={{
          fontSize: 11.5,
          color: stale ? "var(--m-warn)" : "var(--m-ink-3)",
          marginTop: 10,
        }}
      >
        {stale ? "▲ " : ""}
        {movement}
      </div>
      {dialog}
    </div>
  );
}
```

- [ ] **Step 2: Crear el formulario**

Crear `src/components/projects/NewProjectForm.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { createProject } from "@/app/actions";
import { Button } from "@/components/ui/Button";
import { Field, TextArea } from "@/components/ui/Field";

const ICONS = ["📁", "🎯", "🚀", "🎨", "🎮", "📚", "💼", "🏗️", "🌟", "🧪", "🎵", "🌱"];

export function NewProjectForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("📁");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) return;
    const fd = new FormData();
    fd.set("name", name);
    fd.set("description", description);
    fd.set("icon", icon);
    fd.set("color", "lavender");
    startTransition(async () => {
      await createProject(fd);
      onDone();
    });
  }

  return (
    <form
      onSubmit={submit}
      className="m-card"
      style={{ display: "flex", flexDirection: "column", gap: 14 }}
    >
      <Field
        label="Nombre"
        value={name}
        onChange={setName}
        placeholder="ej. Reforma del salón"
        maxLength={60}
        autoFocus
      />
      <TextArea
        label="Descripción (opcional)"
        value={description}
        onChange={setDescription}
        placeholder="De qué va…"
        maxLength={300}
      />

      <div>
        <span style={{ display: "block", fontSize: 12, color: "var(--m-ink-2)", marginBottom: 6 }}>
          Icono
        </span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {ICONS.map((choice) => (
            <button
              key={choice}
              type="button"
              onClick={() => setIcon(choice)}
              aria-pressed={icon === choice}
              aria-label={`Icono ${choice}`}
              style={{
                width: 34,
                height: 34,
                fontSize: 16,
                borderRadius: 7,
                cursor: "pointer",
                background: icon === choice ? "rgba(57, 135, 229, 0.16)" : "var(--m-elevated)",
                border: `1px solid ${icon === choice ? "var(--m-series)" : "var(--m-line)"}`,
              }}
            >
              {choice}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <Button variant="secondary" onClick={onDone} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={pending || !name.trim()}>
          {pending ? "Guardando…" : "Crear"}
        </Button>
      </div>
    </form>
  );
}
```

Nota: el color deja de elegirse y queda fijo en `lavender`. La tarjeta nueva ya
no lo usa —el acento es el mismo en todas— así que pedirlo sería pedir un dato
que nadie mira. El campo sigue en la base de datos y se retirará con el resto de
lo pixel en la fase 3.

- [ ] **Step 3: Crear la cabecera**

Crear `src/components/projects/ProjectsHeader.tsx`:

```tsx
"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { NewProjectForm } from "./NewProjectForm";

/**
 * Cabecera y formulario. Comparten el estado de abierto: el botón va en la
 * cabecera y el formulario debajo, a todo el ancho.
 */
export function ProjectsHeader({ total }: { total: number }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="Proyectos"
        subtitle={
          total === 0
            ? "Descompón lo grande en subtareas anidadas"
            : `${total} en marcha · descompón lo grande en subtareas anidadas`
        }
        action={
          open ? null : (
            <Button variant="primary" onClick={() => setOpen(true)}>
              Nuevo proyecto
            </Button>
          )
        }
      />
      {open ? <NewProjectForm onDone={() => setOpen(false)} /> : null}
    </>
  );
}
```

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit && npx eslint`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/components/projects
git commit -m "Añade la tarjeta, el formulario y la cabecera de proyectos"
```

---

### Task 4: Panel de avance y lista de proyectos

**Files:**
- Create: `src/components/projects/AdvancePanel.tsx`
- Modify: `src/app/projects/page.tsx` (reescritura completa)
- Delete: `src/components/ProjectCard.tsx`, `src/components/NewProjectForm.tsx`

- [ ] **Step 1: Crear el panel**

Crear `src/components/projects/AdvancePanel.tsx`:

```tsx
"use client";

import { Card } from "@/components/ui/Card";
import { BarChart } from "@/components/charts/BarChart";
import { formatDayLabel } from "@/lib/day";
import type { ProjectMetrics } from "@/lib/projects";

export function AdvancePanel({ metrics }: { metrics: ProjectMetrics }) {
  const { weeks, change } = metrics;
  const up = (change.changePercent ?? 0) >= 0;

  return (
    <Card>
      <div className="m-label" style={{ marginBottom: 9 }}>
        Ritmo de avance
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 9, flexWrap: "wrap" }}>
        <span
          className="m-num"
          style={{ fontSize: 28, fontWeight: 650, letterSpacing: "-0.02em", lineHeight: 1 }}
        >
          {change.current}
        </span>
        <span style={{ fontSize: 12.5, color: "var(--m-ink-2)" }}>
          subtareas en 12 semanas
        </span>
        {change.changePercent === null ? null : change.changePercent === 0 ? (
          <span style={{ fontSize: 12.5, color: "var(--m-ink-2)" }}>sin cambio</span>
        ) : (
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 550,
              color: up ? "var(--m-good)" : "var(--m-crit)",
            }}
          >
            {up ? "▲" : "▼"} {Math.abs(change.changePercent)}%
          </span>
        )}
      </div>
      <div style={{ fontSize: 11.5, color: "var(--m-ink-3)", marginTop: 5 }}>
        {change.changePercent === null
          ? "sin periodo anterior con el que comparar"
          : `frente a ${change.previous} en las 12 semanas anteriores`}
      </div>

      <div style={{ marginTop: 16 }}>
        <BarChart
          values={weeks.map((w) => w.count)}
          startLabel={weeks.length ? formatDayLabel(weeks[0].week) : ""}
          endLabel="esta semana"
          ariaLabel={`Subtareas completadas por semana en las últimas ${weeks.length} semanas.`}
          renderTooltip={(i) => (
            <>
              <strong style={{ fontSize: 12.5 }}>
                Semana del {formatDayLabel(weeks[i].week)}
              </strong>
              <br />
              <span style={{ color: "var(--m-ink-2)" }}>
                {weeks[i].count === 1 ? "1 subtarea" : `${weeks[i].count} subtareas`}
              </span>
            </>
          )}
        />
      </div>
    </Card>
  );
}
```

`AdvancePanel` es de cliente **a propósito**: le pasa `renderTooltip`, que es una
función, a `BarChart`, y una función no cruza la frontera servidor → cliente.
Olvidarlo hace que la pantalla entera devuelva 500, y ni los tipos ni el build lo
detectan.

- [ ] **Step 2: Reescribir la lista**

Sustituir **todo** el contenido de `src/app/projects/page.tsx`:

```tsx
import { listProjects, getProjectMetrics } from "@/lib/projects";
import { Card } from "@/components/ui/Card";
import { ProjectsHeader } from "@/components/projects/ProjectsHeader";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { AdvancePanel } from "@/components/projects/AdvancePanel";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const [projects, metrics] = await Promise.all([
    listProjects(),
    getProjectMetrics(),
  ]);

  return (
    <main className="m-root" style={{ minHeight: "100%", padding: "20px 16px 48px" }}>
      <div
        style={{
          maxWidth: 1040,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <ProjectsHeader total={projects.length} />

        {projects.length === 0 ? (
          <Card style={{ textAlign: "center", padding: 40 }}>
            <p style={{ fontSize: 15, marginBottom: 6 }}>Aún no tienes proyectos.</p>
            <p style={{ fontSize: 13, color: "var(--m-ink-2)" }}>
              Crea el primero para descomponerlo en subtareas anidadas.
            </p>
          </Card>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 12,
                alignItems: "start",
              }}
            >
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
            <AdvancePanel metrics={metrics} />
          </>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Borrar los viejos**

```bash
grep -rn "components/ProjectCard\|components/NewProjectForm" src
```

Expected: ninguna coincidencia fuera de los propios archivos. Si aparece otro
consumidor, **repórtalo y no borres nada**.

```bash
git rm src/components/ProjectCard.tsx src/components/NewProjectForm.tsx
```

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit && npx eslint && npm run build`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Reconstruye la lista de proyectos con su ritmo de avance"
```

---

### Task 5: Árbol y detalle de proyecto

**Files:**
- Create: `src/components/projects/ProjectTreeItem.tsx`
- Create: `src/components/projects/ProjectTree.tsx`
- Modify: `src/app/projects/[id]/page.tsx` (reescritura completa)
- Delete: `src/components/ProjectTreeItem.tsx`, `src/components/ProjectTreeRoot.tsx`

- [ ] **Step 1: Crear el nodo del árbol**

Crear `src/components/projects/ProjectTreeItem.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import type { ProjectItemNode, ProjectItemStatus } from "@/lib/projects";
import {
  createProjectItem,
  updateProjectItemStatus,
  deleteProjectItem,
  renameProjectItem,
} from "@/app/actions";
import { emitStatusChange } from "@/lib/events";
import { useConfirm } from "@/components/PixelConfirm";
import { Button } from "@/components/ui/Button";

const STATUS_CYCLE: Record<ProjectItemStatus, ProjectItemStatus> = {
  TODO: "IN_PROGRESS",
  IN_PROGRESS: "DONE",
  DONE: "TODO",
};

const STATUS_MARK: Record<ProjectItemStatus, string> = {
  TODO: "○",
  IN_PROGRESS: "◐",
  DONE: "●",
};

const STATUS_COLOR: Record<ProjectItemStatus, string> = {
  TODO: "var(--m-ink-3)",
  IN_PROGRESS: "var(--m-warn)",
  DONE: "var(--m-good)",
};

const STATUS_NAME: Record<ProjectItemStatus, string> = {
  TODO: "por hacer",
  IN_PROGRESS: "en proceso",
  DONE: "hecha",
};

const ICON_BUTTON = {
  width: 24,
  height: 24,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 6,
  border: "1px solid var(--m-line)",
  background: "transparent",
  color: "var(--m-ink-3)",
  fontSize: 11,
  cursor: "pointer",
  fontFamily: "inherit",
} as const;

export function ProjectTreeItem({
  node,
  depth,
}: {
  node: ProjectItemNode;
  depth: number;
}) {
  const [open, setOpen] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(node.title);
  const [childTitle, setChildTitle] = useState("");
  const [pending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirm();

  // Si el título cambia en el servidor, el borrador lo sigue mientras no
  // estemos editando.
  const [lastTitle, setLastTitle] = useState(node.title);
  if (lastTitle !== node.title) {
    setLastTitle(node.title);
    if (!editing) setDraft(node.title);
  }

  const hasChildren = node.children.length > 0;

  function cycle() {
    startTransition(async () => {
      emitStatusChange(
        await updateProjectItemStatus(node.id, STATUS_CYCLE[node.status]),
      );
    });
  }

  async function remove() {
    const ok = await confirm({
      title: "Borrar subtarea",
      message: hasChildren
        ? `Se borrará "${node.title}" y todas sus subtareas.`
        : `Se borrará "${node.title}".`,
    });
    if (!ok) return;
    startTransition(() => deleteProjectItem(node.id));
  }

  function saveRename() {
    const t = draft.trim();
    if (!t || t === node.title) {
      setEditing(false);
      setDraft(node.title);
      return;
    }
    startTransition(async () => {
      await renameProjectItem(node.id, t);
      setEditing(false);
    });
  }

  function submitChild(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const t = childTitle.trim();
    if (!t) return;
    startTransition(async () => {
      await createProjectItem(node.projectId, node.id, t);
      setChildTitle("");
      setAdding(false);
    });
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 0",
          paddingLeft: depth * 20,
          opacity: pending ? 0.5 : 1,
        }}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={{ ...ICON_BUTTON, visibility: hasChildren ? "visible" : "hidden" }}
          aria-label={open ? `Contraer ${node.title}` : `Expandir ${node.title}`}
          aria-expanded={open}
        >
          {open ? "▾" : "▸"}
        </button>

        <button
          type="button"
          onClick={cycle}
          disabled={pending}
          style={{ ...ICON_BUTTON, color: STATUS_COLOR[node.status], fontSize: 13 }}
          aria-label={`${node.title}: ${STATUS_NAME[node.status]}. Pulsa para cambiar de estado`}
        >
          {STATUS_MARK[node.status]}
        </button>

        {editing ? (
          <input
            autoFocus
            value={draft}
            maxLength={200}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={saveRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveRename();
              if (e.key === "Escape") {
                setEditing(false);
                setDraft(node.title);
              }
            }}
            style={{
              flex: 1,
              background: "var(--m-page)",
              border: "1px solid var(--m-series)",
              borderRadius: 6,
              padding: "5px 9px",
              fontFamily: "inherit",
              fontSize: 13.5,
              color: "var(--m-ink)",
              outline: "none",
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            style={{
              flex: 1,
              textAlign: "left",
              background: "transparent",
              border: 0,
              padding: "5px 0",
              fontFamily: "inherit",
              fontSize: 13.5,
              cursor: "pointer",
              color: node.status === "DONE" ? "var(--m-ink-2)" : "var(--m-ink)",
              textDecoration: node.status === "DONE" ? "line-through" : "none",
            }}
            aria-label={`Renombrar ${node.title}`}
          >
            {node.title}
            {hasChildren ? (
              <span className="m-num" style={{ color: "var(--m-ink-3)", marginLeft: 8 }}>
                {node.children.filter((c) => c.status === "DONE").length}/
                {node.children.length}
              </span>
            ) : null}
          </button>
        )}

        <button
          type="button"
          onClick={() => setAdding(true)}
          disabled={pending}
          style={ICON_BUTTON}
          aria-label={`Añadir subtarea dentro de ${node.title}`}
        >
          +
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          style={{ ...ICON_BUTTON, color: "var(--m-crit)" }}
          aria-label={`Borrar ${node.title}`}
        >
          ✕
        </button>
      </div>

      {open && (hasChildren || adding) ? (
        <div>
          {node.children.map((child) => (
            <ProjectTreeItem key={child.id} node={child} depth={depth + 1} />
          ))}
          {adding ? (
            <form
              onSubmit={submitChild}
              style={{ display: "flex", gap: 8, padding: "6px 0", paddingLeft: (depth + 1) * 20 }}
            >
              <input
                autoFocus
                value={childTitle}
                maxLength={200}
                placeholder="Nueva subtarea…"
                onChange={(e) => setChildTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setAdding(false);
                    setChildTitle("");
                  }
                }}
                style={{
                  flex: 1,
                  background: "var(--m-page)",
                  border: "1px solid var(--m-line)",
                  borderRadius: 6,
                  padding: "5px 9px",
                  fontFamily: "inherit",
                  fontSize: 13.5,
                  color: "var(--m-ink)",
                  outline: "none",
                }}
              />
              <Button type="submit" size="sm" variant="primary" disabled={!childTitle.trim()}>
                Añadir
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setAdding(false);
                  setChildTitle("");
                }}
              >
                Cancelar
              </Button>
            </form>
          ) : null}
        </div>
      ) : null}
      {dialog}
    </div>
  );
}
```

- [ ] **Step 2: Crear la raíz del árbol**

Crear `src/components/projects/ProjectTree.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { createProjectItem } from "@/app/actions";
import type { ProjectItemNode } from "@/lib/projects";
import { Button } from "@/components/ui/Button";
import { ProjectTreeItem } from "./ProjectTreeItem";

export function ProjectTree({
  projectId,
  roots,
}: {
  projectId: string;
  roots: ProjectItemNode[];
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    startTransition(async () => {
      await createProjectItem(projectId, null, t);
      setTitle("");
      setAdding(false);
    });
  }

  return (
    <div>
      {roots.length === 0 && !adding ? (
        <p style={{ fontSize: 13, color: "var(--m-ink-2)", padding: "12px 0" }}>
          Sin subtareas todavía. Añade la primera y empieza a anidar.
        </p>
      ) : (
        roots.map((node) => (
          <ProjectTreeItem key={node.id} node={node} depth={0} />
        ))
      )}

      {adding ? (
        <form onSubmit={submit} style={{ display: "flex", gap: 8, paddingTop: 8 }}>
          <input
            autoFocus
            value={title}
            maxLength={200}
            placeholder="Nueva subtarea…"
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setAdding(false);
                setTitle("");
              }
            }}
            style={{
              flex: 1,
              background: "var(--m-page)",
              border: "1px solid var(--m-line)",
              borderRadius: 6,
              padding: "7px 10px",
              fontFamily: "inherit",
              fontSize: 13.5,
              color: "var(--m-ink)",
              outline: "none",
            }}
          />
          <Button type="submit" variant="primary" size="sm" disabled={pending || !title.trim()}>
            Añadir
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setAdding(false);
              setTitle("");
            }}
          >
            Cancelar
          </Button>
        </form>
      ) : (
        <div style={{ paddingTop: 12 }}>
          <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
            Añadir subtarea
          </Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Reescribir el detalle**

Sustituir **todo** el contenido de `src/app/projects/[id]/page.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectWithTree } from "@/lib/projects";
import { Card } from "@/components/ui/Card";
import { ProjectTree } from "@/components/projects/ProjectTree";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: PageProps<"/projects/[id]">) {
  const { id } = await params;
  const result = await getProjectWithTree(id);
  if (!result) notFound();

  const { project, roots, totalItems, doneItems, lastMovement } = result;
  const percent = totalItems === 0 ? 0 : doneItems / totalItems;

  const movement =
    lastMovement.from === "creation"
      ? "sin avances todavía"
      : lastMovement.days === 0
        ? "último avance hoy"
        : `último avance hace ${lastMovement.days} días`;

  return (
    <main className="m-root" style={{ minHeight: "100%", padding: "20px 16px 48px" }}>
      <div
        style={{
          maxWidth: 820,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <Link
          href="/projects"
          style={{ fontSize: 12.5, color: "var(--m-ink-2)", textDecoration: "none" }}
        >
          ← Proyectos
        </Link>

        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }} aria-hidden>
              {project.icon}
            </span>
            <h1 style={{ fontSize: 22, fontWeight: 650, letterSpacing: "-0.02em" }}>
              {project.name}
            </h1>
          </div>
          {project.description ? (
            <p style={{ fontSize: 13.5, color: "var(--m-ink-2)", marginTop: 6 }}>
              {project.description}
            </p>
          ) : null}
        </div>

        <Card>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 8,
            }}
          >
            <span className="m-num" style={{ fontSize: 15, fontWeight: 600 }}>
              {doneItems} de {totalItems} · {Math.round(percent * 100)}%
            </span>
            <span style={{ fontSize: 11.5, color: "var(--m-ink-3)" }}>{movement}</span>
          </div>
          <div style={{ height: 5, background: "var(--m-track)", borderRadius: 3 }}>
            <div
              style={{
                height: "100%",
                width: `${Math.round(percent * 100)}%`,
                background: "var(--m-series)",
                borderRadius: 3,
              }}
            />
          </div>
        </Card>

        <Card title="Subtareas">
          <ProjectTree projectId={project.id} roots={roots} />
        </Card>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Borrar los viejos**

```bash
grep -rn "components/ProjectTreeItem\|components/ProjectTreeRoot" src
git rm src/components/ProjectTreeItem.tsx src/components/ProjectTreeRoot.tsx
```

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit && npx eslint && npx vitest run && npm run build`
Expected: sin errores, 94 tests.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Reconstruye el detalle de proyecto y su árbol"
```

---

### Task 6: Verificación en navegador

**Files:** ninguno, salvo que aparezcan fallos.

- [ ] **Step 1: Arrancar**

Usar `preview_start` con la configuración `untap-dev`.

- [ ] **Step 2: Estado vacío**

Con la base sin proyectos, `/projects` debe mostrar «Aún no tienes proyectos» y
**ninguna gráfica**.

- [ ] **Step 3: Crear y navegar**

Crear un proyecto desde el botón de la cabecera, comprobando que el formulario
sale **a todo el ancho** debajo, no encajado en el hueco de la acción. Luego:

- La tarjeta muestra 0 de 0, 0% y «creado hoy, sin avances».
- Al pulsar el nombre se entra al detalle.

- [ ] **Step 4: Árbol**

En el detalle: añadir una subtarea raíz, añadirle una hija con el botón `+`,
ciclar el estado de la hija hasta «hecha» pulsando su círculo, y comprobar que
el contador del padre pasa a 1/1 y la barra de progreso sube.

- [ ] **Step 5: Volver a la lista**

`/projects` debe mostrar ahora «avanzaste hoy» y el ritmo de avance con la barra
de esta semana distinta de cero.

- [ ] **Step 6: Renombrar y borrar**

Pulsar el título de una subtarea para renombrarla, confirmar con Enter. Pulsar ✕
y comprobar que sale el diálogo moderno; cancelar y ver que sigue ahí.

- [ ] **Step 7: Anchos, consola y servidor**

Con `resize_window` a 400 y a 1280: sin desbordamiento horizontal. Revisar
`read_console_messages` y `preview_logs`: sin errores.

- [ ] **Step 8: Commit de lo que haya salido**

```bash
git add -A
git commit -m "Corrige lo detectado al verificar Proyectos en navegador"
```

Si no ha salido nada, omitir el commit y decirlo en el informe.

---

## Verificación final

```bash
npm test && npx tsc --noEmit && npx eslint && npm run build
```

Expected: 94 tests en verde, sin errores de tipos, lint limpio y build correcto.
