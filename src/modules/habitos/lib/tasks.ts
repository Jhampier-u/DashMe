import { and, asc, eq, isNotNull, ne } from "drizzle-orm";
import type { Db } from "@/modules/core/db";
import { tasks } from "@/modules/habitos/schema";
import { dayKey } from "./day";
import { resolvePrioridad, type Prioridad } from "./prioridad";
import {
  lifetimeDays,
  median,
  oldestOpenDays,
  periodChange,
  weeklyCounts,
  type PeriodChange,
  type WeekBucket,
} from "./flow";

export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";

export const TASK_STATUSES: TaskStatus[] = ["TODO", "IN_PROGRESS", "DONE"];

export const STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "Por iniciar",
  IN_PROGRESS: "En proceso",
  DONE: "Completadas",
};

/** Lo único que `buildTaskTree` necesita saber de una fila. */
export type TaskTreeInput = {
  id: string;
  parentId: string | null;
};

/** El nodo que devuelve: la fila que le diste, con sus hijos colgando. */
export type TaskTreeNode<T> = T & { children: TaskTreeNode<T>[] };

/**
 * Monta el árbol a partir de una lista plana.
 *
 * Vivía dentro de `getProjectWithTree`. Sube aquí porque desde la unificación
 * lo necesitan las dos pantallas, y porque un árbol mal montado es un fallo que
 * merece su propio test en vez de esconderse dentro de una consulta.
 *
 * Es GENÉRICA en la fila y no fija una forma concreta. Así `/proyectos` puede
 * meter nodos con `projectId: string` y recuperarlos con ese mismo tipo, en vez
 * de con un `string | null` que obligaría a comprobar por todas partes algo que
 * la consulta ya garantiza.
 *
 * Un hijo cuyo padre no está en la lista sale como RAÍZ. No es un caso
 * hipotético: en la base que se pone al día `parent_id` no tiene foránea, así
 * que nada impide que quede colgando. Perderlo en silencio sería peor.
 */
export function buildTaskTree<T extends TaskTreeInput>(
  filas: T[],
): TaskTreeNode<T>[] {
  const map = new Map<string, TaskTreeNode<T>>();
  for (const f of filas) map.set(f.id, { ...f, children: [] });

  const raices: TaskTreeNode<T>[] = [];
  for (const nodo of map.values()) {
    const padre = nodo.parentId ? map.get(nodo.parentId) : undefined;
    if (padre) padre.children.push(nodo);
    else raices.push(nodo);
  }
  return raices;
}

/** Lo que el árbol de la interfaz necesita de cada nodo. */
export type NodoArbol = {
  id: string;
  parentId: string | null;
  title: string;
  status: TaskStatus;
  order: number;
  createdAt: Date;
  completedAt: Date | null;
};

export type TaskFilter = {
  categoriaId: string | null;
  prioridad: Prioridad | null;
};

/** Un parámetro repetido en la URL llega como lista; vale el primero. */
function primero(v: string | string[] | undefined): string | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

/**
 * Lee el filtro de los parámetros de la URL.
 *
 * Que el filtro viva en la URL y no en el estado del cliente es lo que hace que
 * recargar no lo pierda y que «atrás» funcione.
 */
export function parseTaskFilter(sp: {
  [k: string]: string | string[] | undefined;
}): TaskFilter {
  return {
    categoriaId: primero(sp.cat),
    prioridad: resolvePrioridad(primero(sp.pri)),
  };
}

export type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  order: number;
  createdAt: Date;
  completedAt: Date | null;
  categoryId: string | null;
  priority: Prioridad | null;
  /** Cuántas subtareas cuelgan de ella y cuántas están hechas. */
  hijos: { total: number; hechos: number };
  /** Sus descendientes, ya anidados. Vacío si no tiene. */
  arbol: TaskTreeNode<NodoArbol>[];
};

const SIN_FILTRO: TaskFilter = { categoriaId: null, prioridad: null };

/**
 * Las tareas del tablero, agrupadas por estado.
 *
 * Devuelve SOLO LAS RAÍCES. Si devolviera todo, al unificar habrían aparecido
 * de golpe como tarjetas sueltas los elementos anidados de los proyectos,
 * descolgados de su contexto. Las subtareas se cuentan en `hijos` para que el
 * trabajo anidado no desaparezca de la vista sin decir nada.
 */
export async function getTasksGrouped(
  db: Db,
  filtro: TaskFilter = SIN_FILTRO,
): Promise<Record<TaskStatus, TaskRow[]>> {
  const all = await db
    .select()
    .from(tasks)
    .orderBy(asc(tasks.order), asc(tasks.createdAt));

  // Los hijos se cuentan sobre TODAS las filas, filtre lo que filtre la vista:
  // «3 subtareas» es una propiedad de la tarea, no del filtro que tengas puesto.
  const hijosDe = new Map<string, { total: number; hechos: number }>();
  for (const t of all) {
    if (!t.parentId) continue;
    const c = hijosDe.get(t.parentId) ?? { total: 0, hechos: 0 };
    c.total += 1;
    if (t.status === "DONE") c.hechos += 1;
    hijosDe.set(t.parentId, c);
  }

  // El árbol se monta UNA vez sobre todas las filas y después se reparte. Con
  // `buildTaskTree` por raíz habría que recorrer la lista entera una vez por
  // tarjeta.
  const arbolPorRaiz = new Map(
    buildTaskTree(
      all.map((t) => ({
        id: t.id,
        parentId: t.parentId,
        title: t.title,
        status: (t.status as TaskStatus) ?? "TODO",
        order: t.order,
        createdAt: t.createdAt,
        completedAt: t.completedAt,
      })),
    ).map((r) => [r.id, r.children]),
  );

  const grouped: Record<TaskStatus, TaskRow[]> = {
    TODO: [],
    IN_PROGRESS: [],
    DONE: [],
  };
  for (const t of all) {
    if (t.parentId) continue;
    const s = (t.status as TaskStatus) ?? "TODO";
    if (!(s in grouped)) continue;
    if (filtro.categoriaId && t.categoryId !== filtro.categoriaId) continue;
    const prioridad = resolvePrioridad(t.priority);
    if (filtro.prioridad && prioridad !== filtro.prioridad) continue;
    grouped[s].push({
      id: t.id,
      title: t.title,
      description: t.description,
      status: s,
      order: t.order,
      createdAt: t.createdAt,
      completedAt: t.completedAt,
      categoryId: t.categoryId,
      priority: prioridad,
      hijos: hijosDe.get(t.id) ?? { total: 0, hechos: 0 },
      arbol: arbolPorRaiz.get(t.id) ?? [],
    });
  }
  return grouped;
}

/** Semanas que se pintan; se cargan el doble para poder comparar periodos. */
export const FLOW_WEEKS = 12;
/** Ventana de cierres sobre la que se calcula la mediana de vida. */
export const LIFETIME_WINDOW_DAYS = 90;

export type TaskMetrics = {
  weeks: WeekBucket[];
  change: PeriodChange;
  /** Mediana de días entre crear y cerrar. `null` si aún no se ha cerrado nada. */
  medianLifetime: number | null;
  /** Días que lleva esperando la tarea abierta más antigua. */
  oldestOpen: number | null;
};

export async function getTaskMetrics(db: Db): Promise<TaskMetrics> {
  const today = dayKey();
  const [done, open] = await Promise.all([
    db
      .select({ createdAt: tasks.createdAt, completedAt: tasks.completedAt })
      .from(tasks)
      .where(and(eq(tasks.status, "DONE"), isNotNull(tasks.completedAt))),
    db
      .select({ createdAt: tasks.createdAt })
      .from(tasks)
      .where(ne(tasks.status, "DONE")),
  ]);

  const completions = done
    .map((t) => t.completedAt)
    .filter((d): d is Date => d !== null);

  // Se piden el doble de semanas: la primera mitad es el periodo de referencia.
  const buckets = weeklyCounts(completions, FLOW_WEEKS * 2, today);

  const cutoff = new Date(today.getTime());
  cutoff.setUTCDate(cutoff.getUTCDate() - LIFETIME_WINDOW_DAYS);
  const recent = done.filter(
    (t) => t.completedAt !== null && t.completedAt >= cutoff,
  ) as { createdAt: Date; completedAt: Date }[];

  return {
    weeks: buckets.slice(FLOW_WEEKS),
    change: periodChange(buckets),
    medianLifetime: median(lifetimeDays(recent)),
    oldestOpen: oldestOpenDays(open.map((t) => t.createdAt), today),
  };
}

export type TaskDetalle = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  categoryId: string | null;
  priority: Prioridad | null;
  projectId: string | null;
  createdAt: Date;
  completedAt: Date | null;
  /** Sus descendientes, anidados. */
  arbol: TaskTreeNode<NodoArbol>[];
};

/** La tarea del detalle, con su rama del árbol. `null` si no existe. */
export async function getTask(db: Db, id: string): Promise<TaskDetalle | null> {
  const all = await db
    .select()
    .from(tasks)
    .orderBy(asc(tasks.order), asc(tasks.createdAt));
  const propia = all.find((t) => t.id === id);
  if (!propia) return null;

  /*
    UN solo camino y no dos. Se recogen los descendientes de esta tarea y se
    reanidan tratando a sus hijos directos como raíces.

    La alternativa —montar el árbol global y buscar el trozo— falla justo cuando
    la tarea es ella misma una subtarea: entonces no es raíz del árbol global y
    no está en el mapa. Dos caminos, y el segundo es el que se olvida de probar.
  */
  const hijosDirectos = new Set(
    all.filter((t) => t.parentId === id).map((t) => t.id),
  );
  const dentro = new Set(hijosDirectos);
  const cola = [...hijosDirectos];
  while (cola.length > 0) {
    const actual = cola.pop()!;
    for (const t of all) {
      if (t.parentId === actual && !dentro.has(t.id)) {
        dentro.add(t.id);
        cola.push(t.id);
      }
    }
  }

  const arbol = buildTaskTree(
    all
      .filter((t) => dentro.has(t.id))
      .map((t) => ({
        id: t.id,
        // Los hijos directos pasan a raíces de ESTA rama.
        parentId: hijosDirectos.has(t.id) ? null : t.parentId,
        title: t.title,
        status: (t.status as TaskStatus) ?? "TODO",
        order: t.order,
        createdAt: t.createdAt,
        completedAt: t.completedAt,
      })),
  );

  return {
    id: propia.id,
    title: propia.title,
    description: propia.description,
    status: (propia.status as TaskStatus) ?? "TODO",
    categoryId: propia.categoryId,
    priority: resolvePrioridad(propia.priority),
    projectId: propia.projectId,
    createdAt: propia.createdAt,
    completedAt: propia.completedAt,
    arbol,
  };
}
