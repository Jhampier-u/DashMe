"use client";

import { useTransition } from "react";
import type { TaskRow, TaskStatus } from "@/lib/tasks";
import { updateTaskStatus, deleteTask } from "@/app/actions";

type Props = { task: TaskRow };

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

export function TaskCard({ task }: Props) {
  const [pending, startTransition] = useTransition();

  function move(target: TaskStatus | null) {
    if (!target) return;
    startTransition(async () => {
      const result = await updateTaskStatus(task.id, target);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("untap:xp", { detail: result }));
        if (result.leveledUp) {
          window.dispatchEvent(
            new CustomEvent("untap:levelup", { detail: { newLevel: result.newLevel } }),
          );
        }
      }
    });
  }

  function remove() {
    if (!confirm(`¿Borrar "${task.title}"?`)) return;
    const fd = new FormData();
    fd.set("id", task.id);
    startTransition(() => deleteTask(fd));
  }

  const next = NEXT[task.status];
  const prev = PREV[task.status];

  return (
    <div
      className="p-3 pixel-edge-tight flex flex-col gap-2"
      style={{
        background: "var(--color-bg-deep)",
        opacity: pending ? 0.5 : 1,
        textDecoration: task.status === "DONE" ? "line-through" : "none",
      }}
    >
      <div className="text-base text-[var(--color-ink)]">{task.title}</div>
      {task.description ? (
        <div className="text-sm text-[var(--color-ink-soft)]">{task.description}</div>
      ) : null}
      <div className="flex gap-1 mt-1">
        <button
          type="button"
          onClick={() => move(prev)}
          disabled={!prev || pending}
          className="pixel-button font-display text-[0.55rem] px-2 py-1 flex-1"
          style={{
            background: prev ? "var(--color-surface)" : "var(--color-bg)",
            color: "var(--color-ink)",
            boxShadow: "0 0 0 2px var(--color-border)",
            opacity: prev ? 1 : 0.3,
          }}
        >
          ◄
        </button>
        <button
          type="button"
          onClick={() => move(next)}
          disabled={!next || pending}
          className="pixel-button font-display text-[0.55rem] px-2 py-1 flex-1"
          style={{
            background: next ? "var(--color-mint-dark)" : "var(--color-bg)",
            color: "var(--color-ink)",
            boxShadow: "0 0 0 2px var(--color-border)",
            opacity: next ? 1 : 0.3,
          }}
        >
          ►
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className="pixel-button font-display text-[0.55rem] px-2 py-1"
          style={{
            background: "var(--color-pink-dark)",
            color: "var(--color-ink)",
            boxShadow: "0 0 0 2px var(--color-border)",
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
