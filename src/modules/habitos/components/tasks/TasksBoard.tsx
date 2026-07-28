import type { TaskRow, TaskStatus } from "@/modules/habitos/lib/tasks";
import { TASK_STATUSES, STATUS_LABEL } from "@/modules/habitos/lib/tasks";
import { TaskCard } from "./TaskCard";

type Props = { grouped: Record<TaskStatus, TaskRow[]> };

export function TasksBoard({ grouped }: Props) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
        gap: 12,
        alignItems: "start",
      }}
    >
      {TASK_STATUSES.map((status) => (
        <div key={status}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 10,
            }}
          >
            <span className="m-label">{STATUS_LABEL[status]}</span>
            <span className="m-num" style={{ fontSize: 12, color: "var(--m-ink-3)" }}>
              {grouped[status].length}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {grouped[status].length === 0 ? (
              <div
                style={{
                  border: "1px dashed var(--m-line)",
                  borderRadius: 9,
                  padding: "16px 12px",
                  fontSize: 12.5,
                  color: "var(--m-ink-3)",
                  textAlign: "center",
                }}
              >
                Nada aquí
              </div>
            ) : (
              grouped[status].map((task) => <TaskCard key={task.id} task={task} />)
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
