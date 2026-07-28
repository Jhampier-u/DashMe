"use client";

import { useTransition } from "react";
import type { TaskRow, TaskStatus } from "@/lib/tasks";
import { updateTaskStatus, deleteTask } from "@/app/actions";
import { emitStatusChange } from "@/lib/events";
import { useConfirm } from "@/components/ConfirmDialog";

const NEXT: Record<TaskStatus, TaskStatus | null> = {
  TODO: "IN_PROGRESS",
  IN_PROGRESS: "DONE",
  DONE: null,
};
const PREV: Record<TaskStatus, TaskStatus | null> = {
  TODO: null,
  IN_PROGRESS: "TODO",
  DONE: "IN_PROGRESS",
};

const MOVE_BUTTON = {
  width: 26,
  height: 26,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 6,
  border: "1px solid var(--m-line)",
  background: "var(--m-elevated)",
  color: "var(--m-ink-2)",
  fontSize: 11,
  cursor: "pointer",
  fontFamily: "inherit",
} as const;

export function TaskCard({ task }: { task: TaskRow }) {
  const [pending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirm();

  function move(target: TaskStatus | null) {
    if (!target) return;
    startTransition(async () => {
      emitStatusChange(await updateTaskStatus(task.id, target));
    });
  }

  async function remove() {
    const ok = await confirm({
      title: "Borrar tarea",
      message: `Se borrará "${task.title}".`,
    });
    if (!ok) return;
    const fd = new FormData();
    fd.set("id", task.id);
    startTransition(() => deleteTask(fd));
  }

  const next = NEXT[task.status];
  const prev = PREV[task.status];
  const done = task.status === "DONE";

  return (
    <div
      style={{
        background: "var(--m-surface)",
        border: "1px solid var(--m-line)",
        borderRadius: 9,
        padding: 12,
        opacity: pending ? 0.5 : 1,
      }}
    >
      <div
        style={{
          fontSize: 13.5,
          color: done ? "var(--m-ink-2)" : "var(--m-ink)",
          textDecoration: done ? "line-through" : "none",
        }}
      >
        {task.title}
      </div>
      {task.description ? (
        <div style={{ fontSize: 12, color: "var(--m-ink-3)", marginTop: 5 }}>
          {task.description}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 5, marginTop: 10 }}>
        <button
          type="button"
          onClick={() => move(prev)}
          disabled={!prev || pending}
          style={{ ...MOVE_BUTTON, opacity: prev ? 1 : 0.3 }}
          aria-label={`Mover ${task.title} hacia atrás`}
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => move(next)}
          disabled={!next || pending}
          style={{ ...MOVE_BUTTON, opacity: next ? 1 : 0.3 }}
          aria-label={`Mover ${task.title} hacia adelante`}
        >
          →
        </button>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          style={{ ...MOVE_BUTTON, color: "var(--m-crit)" }}
          aria-label={`Borrar ${task.title}`}
        >
          ✕
        </button>
      </div>
      {dialog}
    </div>
  );
}
