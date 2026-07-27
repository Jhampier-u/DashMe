"use client";

import { useState } from "react";
import { ComplianceChart, type ChartPoint } from "@/components/charts/ComplianceChart";
import type { PeriodDelta } from "@/lib/metrics";

const RANGES = [
  { key: "28d", label: "28d", days: 28 },
  { key: "90d", label: "90d", days: 90 },
  { key: "12m", label: "12m", days: 365 },
] as const;

type Props = {
  points: ChartPoint[];
  delta: PeriodDelta | null;
};

export function TrendCard({ points, delta }: Props) {
  // Se guarda el rango completo (no solo la clave) para no tener que volver a
  // buscarlo en RANGES con una aserción no nula: el estado inicial ya es un
  // elemento real del array, así que siempre hay un `days` válido a mano.
  const [range, setRange] = useState<(typeof RANGES)[number]>(RANGES[0]);
  const visible = points.slice(-range.days);

  const up = (delta?.deltaPoints ?? 0) >= 0;

  return (
    <div className="m-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div className="m-label" style={{ marginBottom: 9 }}>
            Cumplimiento
          </div>
          {delta === null ? (
            <div style={{ fontSize: 13, color: "var(--m-ink-2)" }}>
              Aún no hay datos suficientes.
            </div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
                <span className="m-num" style={{ fontSize: 30, fontWeight: 650, letterSpacing: "-0.02em", lineHeight: 1 }}>
                  {Math.round(delta.current * 100)}%
                </span>
                {delta.deltaPoints === null ? null : (
                  <span
                    style={{
                      fontSize: 12.5,
                      fontWeight: 550,
                      color: up ? "var(--m-good)" : "var(--m-crit)",
                    }}
                  >
                    {up ? "▲" : "▼"} {Math.abs(delta.deltaPoints)} pts
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--m-ink-3)", marginTop: 5 }}>
                {delta.previous === null
                  ? "sin periodo anterior con el que comparar"
                  : `frente a ${Math.round(delta.previous * 100)}% en los 28 días anteriores`}
              </div>
            </>
          )}
        </div>

        <div
          style={{
            display: "flex",
            gap: 2,
            background: "var(--m-elevated)",
            border: "1px solid var(--m-line)",
            borderRadius: 7,
            padding: 2,
          }}
        >
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r)}
              aria-pressed={range.key === r.key}
              style={{
                fontFamily: "inherit",
                fontSize: 11.5,
                color: range.key === r.key ? "var(--m-ink)" : "var(--m-ink-2)",
                background: range.key === r.key ? "rgba(255,255,255,0.09)" : "none",
                border: 0,
                padding: "4px 10px",
                borderRadius: 5,
                cursor: "pointer",
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <ComplianceChart points={visible} />
      </div>
    </div>
  );
}
