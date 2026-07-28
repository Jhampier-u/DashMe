import type { HabitWithStatus } from "@/modules/habitos/lib/habits";

/**
 * Regla de los 2 días. El color va siempre acompañado de icono y texto: quien
 * no distingue el rojo debe recibir el mismo aviso.
 */
export function CriticalBanner({ habits }: { habits: HabitWithStatus[] }) {
  const critical = habits.filter((h) => h.criticalToday);
  if (critical.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        background: "rgba(226, 96, 96, 0.10)",
        border: "1px solid rgba(226, 96, 96, 0.35)",
        borderRadius: 10,
        padding: "12px 14px",
      }}
    >
      <span aria-hidden style={{ color: "var(--m-crit)", fontSize: 13 }}>
        ▲
      </span>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--m-crit)" }}>
          {critical.length === 1
            ? "Un hábito viene de fallar"
            : `${critical.length} hábitos vienen de fallar`}
        </div>
        <div style={{ fontSize: 12.5, color: "var(--m-ink-2)", marginTop: 4 }}>
          Fallar dos veces seguidas es lo que rompe una racha:{" "}
          {critical.map((h) => h.name).join(", ")}.
        </div>
      </div>
    </div>
  );
}
