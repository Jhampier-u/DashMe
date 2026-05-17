import type { TaskRow, TaskStatus } from "@/lib/tasks";
import { TASK_STATUSES, STATUS_LABEL, STATUS_TONE } from "@/lib/tasks";
import { TaskCard } from "./TaskCard";
import { PixelWindow } from "./PixelWindow";
import { NewTaskForm } from "./NewTaskForm";

type Props = { grouped: Record<TaskStatus, TaskRow[]> };

export function TasksBoard({ grouped }: Props) {
  const total = TASK_STATUSES.reduce((s, k) => s + grouped[k].length, 0);
  return (
    <PixelWindow title={`Tareas · ${total}`}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {TASK_STATUSES.map((status) => (
          <div
            key={status}
            className="p-2 flex flex-col gap-2"
            style={{
              background: "var(--color-surface)",
              boxShadow: "0 0 0 2px var(--color-border)",
              minHeight: "8rem",
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <span
                className="font-display text-[0.6rem] tracking-wider"
                style={{ color: STATUS_TONE[status] }}
              >
                {STATUS_LABEL[status].toUpperCase()}
              </span>
              <span className="text-sm text-[var(--color-ink-dim)]">
                {grouped[status].length}
              </span>
            </div>
            {grouped[status].length === 0 ? (
              <div className="text-center text-[var(--color-ink-dim)] text-sm py-3 italic">
                vacío
              </div>
            ) : (
              grouped[status].map((t) => <TaskCard key={t.id} task={t} />)
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-center mt-4">
        <NewTaskForm />
      </div>
    </PixelWindow>
  );
}
