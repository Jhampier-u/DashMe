import { prisma } from "./prisma";

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
