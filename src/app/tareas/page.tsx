import { db } from "@/modules/core/db";
import { getTasksGrouped, getTaskMetrics } from "@/modules/habitos";
import { Card } from "@/modules/core/ui/Card";
import { TasksBoard } from "@/modules/habitos/components/tasks/TasksBoard";
import { TasksHeader } from "@/modules/habitos/components/tasks/TasksHeader";
import { FlowPanel } from "@/modules/habitos/components/tasks/FlowPanel";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const [grouped, metrics] = await Promise.all([
    getTasksGrouped(db),
    getTaskMetrics(db),
  ]);

  const total =
    grouped.TODO.length + grouped.IN_PROGRESS.length + grouped.DONE.length;

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
        <TasksHeader total={total} />

        {total === 0 ? (
          <Card style={{ textAlign: "center", padding: 40 }}>
            <p style={{ fontSize: 15, marginBottom: 6 }}>Aún no tienes tareas.</p>
            <p style={{ fontSize: 13, color: "var(--m-ink-2)" }}>
              Crea la primera y esta pantalla empezará a medir tu ritmo.
            </p>
          </Card>
        ) : (
          <>
            <TasksBoard grouped={grouped} />
            <FlowPanel metrics={metrics} />
          </>
        )}
      </div>
    </main>
  );
}
