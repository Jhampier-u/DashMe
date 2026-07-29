import { and, asc, eq, isNotNull } from "drizzle-orm";
import type { Db } from "@/modules/core/db";
import { projects, tasks } from "@/modules/habitos/schema";
import { dayKey } from "./day";
import { buildTaskTree, type TaskStatus, type TaskTreeNode } from "./tasks";
import {
  daysSince,
  periodChange,
  weeklyCounts,
  type PeriodChange,
  type WeekBucket,
} from "./flow";

/*
  Un elemento de proyecto ES una tarea desde la unificación. Los estados se
  reexportan con su nombre viejo para no mantener dos listas de lo mismo; lo que
  se pinta y lo que se guarda son ya la misma cosa.
*/
export type { TaskStatus as ProjectItemStatus } from "./tasks";
export { TASK_STATUSES as PROJECT_ITEM_STATUSES } from "./tasks";

/**
 * Un nodo del árbol de un proyecto. Es una tarea con hijos: desde la
 * unificación no hay un tipo aparte para «elemento de proyecto», solo este
 * alias, que fija `projectId` como `string` porque dentro de un proyecto
 * siempre lo hay.
 */
export type ProjectItemNode = TaskTreeNode<{
  id: string;
  projectId: string;
  parentId: string | null;
  title: string;
  status: TaskStatus;
  order: number;
  createdAt: Date;
  completedAt: Date | null;
}>;

export type ProjectSummary = {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  createdAt: Date;
  totalItems: number;
  doneItems: number;
  /**
   * Días desde el último avance. `from` dice si se cuenta desde una subtarea
   * completada o, cuando no hay ninguna, desde la creación del proyecto: un
   * proyecto sin nada hecho no lleva "cero días parado".
   */
  lastMovement: { days: number; from: "completion" | "creation" };
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

export async function listProjects(db: Db): Promise<ProjectSummary[]> {
  const today = dayKey();

  // Sin API relacional: una consulta por tabla y agrupación en memoria. Traer
  // todas las subtareas de golpe evita el N+1 de consultar por proyecto.
  const [filas, items] = await Promise.all([
    db.select().from(projects).orderBy(asc(projects.createdAt)),
    db
      .select({
        projectId: tasks.projectId,
        status: tasks.status,
        completedAt: tasks.completedAt,
      })
      .from(tasks)
      .where(isNotNull(tasks.projectId)),
  ]);

  const itemsPorProyecto = new Map<string, typeof items>();
  for (const it of items) {
    // `isNotNull` ya las filtró en SQL; esto es lo que se lo dice a TypeScript.
    if (it.projectId === null) continue;
    const lista = itemsPorProyecto.get(it.projectId);
    if (lista) lista.push(it);
    else itemsPorProyecto.set(it.projectId, [it]);
  }

  return filas.map((p) => {
    const propios = itemsPorProyecto.get(p.id) ?? [];
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      icon: p.icon,
      createdAt: p.createdAt,
      totalItems: propios.length,
      doneItems: propios.filter((i) => i.status === "DONE").length,
      lastMovement: movementOf(
        propios.map((i) => i.completedAt),
        p.createdAt,
        today,
      ),
    };
  });
}

export async function getProjectWithTree(db: Db, id: string) {
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);
  if (!project) return null;
  const items = await db
    .select()
    .from(tasks)
    .where(eq(tasks.projectId, id))
    .orderBy(asc(tasks.order), asc(tasks.createdAt));

  const roots = buildTaskTree(
    items.map((it) => ({
      id: it.id,
      // `?? id` no es defensa por si acaso: la consulta filtra por
      // `projectId = id`, así que solo le dice a TypeScript lo que el SQL ya
      // garantiza, y de paso el nodo sale con `projectId: string` en vez de
      // `string | null`. `ProjectTreeItem` se lo pasa a `createProjectTask`,
      // que exige un string.
      projectId: it.projectId ?? id,
      parentId: it.parentId,
      title: it.title,
      status: (it.status as TaskStatus) ?? "TODO",
      order: it.order,
      createdAt: it.createdAt,
      completedAt: it.completedAt,
    })),
  );

  // count totals (recursive)
  function counts(nodes: ProjectItemNode[]): { total: number; done: number } {
    let total = 0;
    let done = 0;
    for (const n of nodes) {
      total += 1;
      if (n.status === "DONE") done += 1;
      const c = counts(n.children);
      total += c.total;
      done += c.done;
    }
    return { total, done };
  }
  const { total, done } = counts(roots);

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
}

/** Semanas que se pintan; se cargan el doble para poder comparar periodos. */
export const ADVANCE_WEEKS = 12;

export type ProjectMetrics = {
  weeks: WeekBucket[];
  change: PeriodChange;
};

/** Ritmo de avance: subtareas completadas por semana, en todos los proyectos. */
export async function getProjectMetrics(db: Db): Promise<ProjectMetrics> {
  const today = dayKey();
  const items = await db
    .select({ completedAt: tasks.completedAt })
    .from(tasks)
    .where(
      and(
        eq(tasks.status, "DONE"),
        isNotNull(tasks.projectId),
        isNotNull(tasks.completedAt),
      ),
    );

  const completions = items
    .map((i) => i.completedAt)
    .filter((d): d is Date => d !== null);

  const buckets = weeklyCounts(completions, ADVANCE_WEEKS * 2, today);
  return { weeks: buckets.slice(ADVANCE_WEEKS), change: periodChange(buckets) };
}
