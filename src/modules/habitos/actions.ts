"use server";

/*
  Envoltorio fino sobre `lib/mutations.ts`.

  Los server actions se invocan desde el navegador, así que no pueden recibir la
  conexión por parámetro: la toman del singleton. Y como en un archivo
  "use server" TODO lo exportado se convierte en server action, la lógica vive
  en mutations.ts, que sí acepta la base y por eso se puede testear contra una
  en memoria.

  Aquí solo pasan dos cosas: se inyecta `db` y se llama a `refresh()`.
*/

import { refresh } from "next/cache";
import { db } from "@/modules/core/db";
import type { TaskStatus } from "./lib/tasks";
import * as m from "./lib/mutations";

export type {
  ToggleResult,
  StatusChangeResult,
  PlayerSnapshot,
} from "./lib/mutations";

// ---------- HÁBITOS ----------

export async function toggleToday(habitId: string, partial = false) {
  const r = await m.toggleToday(db, habitId, partial);
  refresh();
  return r;
}

export async function toggleHabitOnDay(habitId: string, isoDate: string) {
  const r = await m.toggleHabitOnDay(db, habitId, isoDate);
  refresh();
  return r;
}

export async function createHabit(formData: FormData) {
  await m.createHabit(db, formData);
  refresh();
}

export async function setHabitAnchor(habitId: string, makeAnchor: boolean) {
  await m.setHabitAnchor(db, habitId, makeAnchor);
  refresh();
}

export async function updateHabitSchedule(habitId: string, schedule: string) {
  await m.updateHabitSchedule(db, habitId, schedule);
  refresh();
}

export async function updateHabitIntention(habitId: string, intention: string) {
  await m.updateHabitIntention(db, habitId, intention);
  refresh();
}

export async function deleteHabit(formData: FormData) {
  await m.deleteHabit(db, formData);
  refresh();
}

// Lecturas que antes eran endpoints GET públicos en /api. Como Server
// Functions viajan por el mismo canal que el resto y no añaden superficie.

export async function fetchHabitMonth(
  habitId: string,
  year: number,
  monthIndex: number,
) {
  return m.fetchHabitMonth(db, habitId, year, monthIndex);
}

export async function fetchHabitStats(habitId: string) {
  return m.fetchHabitStats(db, habitId);
}

// ---------- TAREAS ----------

export async function createTask(formData: FormData) {
  await m.createTask(db, formData);
  refresh();
}

export async function updateTaskStatus(taskId: string, newStatus: TaskStatus) {
  const r = await m.updateTaskStatus(db, taskId, newStatus);
  refresh();
  return r;
}

export async function deleteTask(formData: FormData) {
  await m.deleteTask(db, formData);
  refresh();
}

// ---------- PROYECTOS ----------

export async function createProject(formData: FormData) {
  await m.createProject(db, formData);
  refresh();
}

export async function deleteProject(formData: FormData) {
  await m.deleteProject(db, formData);
  refresh();
}

export async function createProjectTask(
  projectId: string,
  parentId: string | null,
  title: string,
) {
  await m.createProjectTask(db, projectId, parentId, title);
  refresh();
}

/*
  `updateProjectItemStatus` ya no existe: mover un elemento de proyecto y mover
  una tarea son la misma operación sobre la misma tabla. El árbol usa
  `updateTaskStatus`.
*/

export async function deleteProjectItem(itemId: string) {
  await m.deleteTaskById(db, itemId);
  refresh();
}

export async function renameTask(taskId: string, newTitle: string) {
  await m.renameTask(db, taskId, newTitle);
  refresh();
}
