import { prisma } from "./prisma";
import { dayKey } from "./day";
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

export const STATUS_TONE: Record<TaskStatus, string> = {
  TODO: "var(--color-sky)",
  IN_PROGRESS: "var(--color-peach)",
  DONE: "var(--color-mint)",
};

export type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  order: number;
  createdAt: Date;
  completedAt: Date | null;
};

export async function getTasksGrouped(): Promise<Record<TaskStatus, TaskRow[]>> {
  const all = await prisma.task.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
  const grouped: Record<TaskStatus, TaskRow[]> = {
    TODO: [],
    IN_PROGRESS: [],
    DONE: [],
  };
  for (const t of all) {
    const s = (t.status as TaskStatus) ?? "TODO";
    if (s in grouped) {
      grouped[s].push({ ...t, status: s });
    }
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

export async function getTaskMetrics(): Promise<TaskMetrics> {
  const today = dayKey();
  const [done, open] = await Promise.all([
    prisma.task.findMany({
      where: { status: "DONE", completedAt: { not: null } },
      select: { createdAt: true, completedAt: true },
    }),
    prisma.task.findMany({
      where: { status: { not: "DONE" } },
      select: { createdAt: true },
    }),
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
