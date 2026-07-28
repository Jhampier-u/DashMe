"use client";

// De cliente porque le pasa `renderTooltip` a BarChart, y una función no cruza
// la frontera servidor → cliente. Es la misma razón por la que TrendCard lo es.

import { Card } from "@/modules/core/ui/Card";
import { Stat, StatGrid } from "@/modules/core/ui/Stat";
import { BarChart } from "@/modules/habitos/components/charts/BarChart";
import { formatDayLabel, formatDays } from "@/modules/habitos/lib/day";
import type { TaskMetrics } from "@/modules/habitos/lib/tasks";

export function FlowPanel({ metrics }: { metrics: TaskMetrics }) {
  const { weeks, change, medianLifetime, oldestOpen } = metrics;
  const up = (change.changePercent ?? 0) >= 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Card>
        <div className="m-label" style={{ marginBottom: 9 }}>
          Ritmo de cierre
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 9, flexWrap: "wrap" }}>
          <span
            className="m-num"
            style={{ fontSize: 28, fontWeight: 650, letterSpacing: "-0.02em", lineHeight: 1 }}
          >
            {change.current}
          </span>
          <span style={{ fontSize: 12.5, color: "var(--m-ink-2)" }}>en 12 semanas</span>
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
            ariaLabel={`Tareas completadas por semana en las últimas ${weeks.length} semanas.`}
            renderTooltip={(i) => (
              <>
                <strong style={{ fontSize: 12.5 }}>
                  Semana del {formatDayLabel(weeks[i].week)}
                </strong>
                <br />
                <span style={{ color: "var(--m-ink-2)" }}>
                  {weeks[i].count === 1 ? "1 tarea" : `${weeks[i].count} tareas`}
                </span>
              </>
            )}
          />
        </div>
      </Card>

      <StatGrid min={180} gap={12}>
        <Stat
          label="Tiempo de vida"
          value={medianLifetime === null ? "—" : formatDays(medianLifetime)}
          meta={medianLifetime === null ? "aún no has cerrado nada" : "mediana, últimos 90 días"}
        />
        <Stat
          label="Lo más antiguo abierto"
          value={oldestOpen === null ? "—" : formatDays(oldestOpen)}
          meta={oldestOpen === null ? "no queda nada abierto" : "desde que se creó"}
        />
      </StatGrid>
    </div>
  );
}
