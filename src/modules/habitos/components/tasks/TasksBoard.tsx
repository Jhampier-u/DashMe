import type { CSSProperties } from "react";
import type { TaskRow, TaskStatus } from "@/modules/habitos/lib/tasks";
import { TASK_STATUSES, STATUS_LABEL } from "@/modules/habitos/lib/tasks";
import { TaskCard } from "./TaskCard";

/*
  El estado de una tarea no es identidad de hábito ni armazón de la interfaz,
  así que no se inventa un color para él: se reusa el vocabulario que ya existe.

  «Hecho» lleva el mismo sello invertido —tinta maciza con la letra en papel—
  que en la fila de hábito. Que el mismo concepto se vea igual en dos pantallas
  es coherencia de sistema, no adorno.
*/
const CONTADOR: Record<TaskStatus, CSSProperties> = {
  TODO: { background: "var(--color-paper-2)", color: "var(--color-tinta)" },
  IN_PROGRESS: { background: "var(--color-sky)", color: "var(--color-tinta)" },
  DONE: { background: "var(--color-tinta)", color: "var(--color-paper)" },
};

const CONTADOR_BASE: CSSProperties = {
  fontFamily: "var(--font-vt)",
  fontSize: 16,
  lineHeight: 1,
  fontVariantNumeric: "tabular-nums",
  padding: "3px 9px",
  borderRadius: 999,
  border: "2px solid var(--color-line)",
};

/** El rótulo de columna. VT323 a 16, su suelo. */
const ROTULO: CSSProperties = {
  fontFamily: "var(--font-vt)",
  fontSize: 16,
  lineHeight: 1,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--color-tinta)",
};

type Props = { grouped: Record<TaskStatus, TaskRow[]> };

export function TasksBoard({ grouped }: Props) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
        // Más aire: con trazo de 3px y sombra dura, las sombras se muerden con
        // la tarjeta de al lado.
        gap: 16,
        alignItems: "start",
      }}
    >
      {TASK_STATUSES.map((status) => (
        <div key={status}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <span style={ROTULO}>{STATUS_LABEL[status]}</span>
            <span style={{ ...CONTADOR_BASE, ...CONTADOR[status] }}>
              {grouped[status].length}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {grouped[status].length === 0 ? (
              <div
                style={{
                  border: "3px dashed var(--color-line)",
                  borderRadius: "var(--radius-card)",
                  padding: "20px 12px",
                  fontSize: 12.5,
                  color: "var(--color-tinta)",
                  fontFamily: "var(--font-cuerpo)",
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
