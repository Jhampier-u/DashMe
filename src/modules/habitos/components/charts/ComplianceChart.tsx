"use client";

// Envoltorio de dominio sobre LineChart: aquí viven los conceptos de hábitos
// (media móvil, escudos, días programados) traducidos a las series de
// números crudos que el genérico sabe dibujar.

import { LineChart } from "@/modules/habitos/components/charts/LineChart";
import { formatDayLabel } from "@/modules/habitos/lib/day";

export type ChartPoint = {
  date: string;
  /** Cumplimiento crudo del día, null si no tocaba nada. */
  rate: number | null;
  /** Media móvil de 7 días, null mientras no haya ningún dato. */
  mean: number | null;
  done: number;
  scheduled: number;
  shielded: number;
};

export function ComplianceChart({ points }: { points: ChartPoint[] }) {
  if (points.length === 0) return null;

  return (
    <LineChart
      line={points.map((p) => p.mean)}
      dots={points.map((p) => p.rate)}
      highlighted={points.map((p) => p.shielded > 0)}
      ticks={[0, 0.5, 1]}
      formatTick={(value) => `${Math.round(value * 100)}`}
      startLabel={formatDayLabel(points[0].date)}
      endLabel="hoy"
      ariaLabel={`Cumplimiento diario de los últimos ${points.length} días con media móvil de 7 días.`}
      renderTooltip={(index) => {
        const active = points[index];
        return (
          <>
            <strong style={{ fontSize: 12.5 }}>{formatDayLabel(active.date)}</strong>
            <br />
            {active.mean === null ? "Sin datos" : `Media 7d: ${Math.round(active.mean * 100)}%`}
            <br />
            <span style={{ color: "var(--m-ink-3)" }}>
              {active.scheduled === 0
                ? "No tocaba nada"
                : `Ese día: ${active.done} de ${active.scheduled}`}
              {active.shielded > 0 ? ` · ${active.shielded} con escudo` : ""}
            </span>
          </>
        );
      }}
    />
  );
}
