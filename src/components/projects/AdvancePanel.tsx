"use client";

import { Card } from "@/components/ui/Card";
import { BarChart } from "@/components/charts/BarChart";
import { formatDayLabel } from "@/lib/day";
import type { ProjectMetrics } from "@/lib/projects";

export function AdvancePanel({ metrics }: { metrics: ProjectMetrics }) {
  const { weeks, change } = metrics;
  const up = (change.changePercent ?? 0) >= 0;

  return (
    <Card>
      <div className="m-label" style={{ marginBottom: 9 }}>
        Ritmo de avance
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 9, flexWrap: "wrap" }}>
        <span
          className="m-num"
          style={{ fontSize: 28, fontWeight: 650, letterSpacing: "-0.02em", lineHeight: 1 }}
        >
          {change.current}
        </span>
        <span style={{ fontSize: 12.5, color: "var(--m-ink-2)" }}>
          subtareas en 12 semanas
        </span>
        {change.changePercent === null ? null : change.changePercent === 0 ? (
          <span style={{ fontSize: 12.5, color: "var(--m-ink-2)" }}>sin cambio</span>
        ) : (
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 550,
              color: up ? "var(--m-good)" : "var(--m-crit)",
            }}
          >
            {up ? "▲" : "▼"} {Math.abs(change.changePercent)}%
          </span>
        )}
      </div>
      <div style={{ fontSize: 11.5, color: "var(--m-ink-3)", marginTop: 5 }}>
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
              <span style={{ color: "var(--m-ink-2)" }}>
                {weeks[i].count === 1 ? "1 subtarea" : `${weeks[i].count} subtareas`}
              </span>
            </>
          )}
        />
      </div>
    </Card>
  );
}
