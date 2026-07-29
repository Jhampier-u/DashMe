"use client";

import { Card } from "@/modules/core/ui/Card";
import { BarChart } from "@/modules/habitos/components/charts/BarChart";
import { formatDayLabel } from "@/modules/habitos/lib/day";
import type { ProjectMetrics } from "@/modules/habitos/lib/projects";

export function AdvancePanel({ metrics }: { metrics: ProjectMetrics }) {
  const { weeks, change } = metrics;
  const up = (change.changePercent ?? 0) >= 0;

  return (
    <Card title="Ritmo de avance">
      <div style={{ display: "flex", alignItems: "baseline", gap: 9, flexWrap: "wrap" }}>
        <span
          style={{
            fontFamily: "var(--font-vt)",
            fontSize: 30,
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {change.current}
        </span>
        <span style={{ fontSize: 12.5 }}>subtareas en 12 semanas</span>
        {change.changePercent === null ? null : change.changePercent === 0 ? (
          <span style={{ fontSize: 12.5 }}>sin cambio</span>
        ) : (
          // Iba en verde o rojo. Ahora lo dicen la flecha y el grosor, igual
          // que en TrendCard y FlowPanel.
          <span style={{ fontSize: 12.5, fontWeight: 700 }}>
            {up ? "▲" : "▼"} {Math.abs(change.changePercent)}%
          </span>
        )}
      </div>
      <div style={{ fontSize: 11.5, marginTop: 6 }}>
        {change.changePercent === null
          ? "sin periodo anterior con el que comparar"
          : `frente a ${change.previous} en las 12 semanas anteriores`}
      </div>

      <div style={{ marginTop: 16 }}>
        <BarChart
          values={weeks.map((w) => w.count)}
          startLabel={weeks.length ? formatDayLabel(weeks[0].week) : ""}
          endLabel="esta semana"
          ariaLabel={`Subtareas completadas por semana en las últimas ${weeks.length} semanas.`}
          renderTooltip={(i) => (
            <>
              <strong style={{ fontSize: 12.5 }}>
                Semana del {formatDayLabel(weeks[i].week)}
              </strong>
              <br />
              {/* El tooltip ya fija su tinta. */}
              <span>
                {weeks[i].count === 1 ? "1 subtarea" : `${weeks[i].count} subtareas`}
              </span>
            </>
          )}
        />
      </div>
    </Card>
  );
}
