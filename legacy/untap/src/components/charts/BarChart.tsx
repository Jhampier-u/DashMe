"use client";

import { useState, type ReactNode } from "react";

export type BarChartProps = {
  /** Una barra por elemento. */
  values: number[];
  /** Contenido del tooltip para la barra bajo el ratón. */
  renderTooltip: (index: number) => ReactNode;
  startLabel: string;
  endLabel: string;
  ariaLabel: string;
  height?: number;
};

/**
 * Barras verticales. No sabe qué cuenta: recibe números, igual que LineChart.
 * Con todo a cero pinta la base sin barras, en vez de dividir por cero al
 * escalar.
 */
export function BarChart({
  values,
  renderTooltip,
  startLabel,
  endLabel,
  ariaLabel,
  height = 120,
}: BarChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  if (values.length === 0) return null;

  const max = Math.max(...values);

  return (
    <div style={{ position: "relative" }}>
      <div
        role="img"
        aria-label={ariaLabel}
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 3,
          height,
          borderBottom: "1px solid var(--m-line)",
        }}
        onMouseLeave={() => setHover(null)}
      >
        {values.map((value, i) => (
          <div
            key={i}
            onMouseEnter={() => setHover(i)}
            style={{
              flex: 1,
              height: "100%",
              display: "flex",
              alignItems: "flex-end",
              cursor: "default",
            }}
          >
            <div
              style={{
                width: "100%",
                height: max === 0 ? 0 : `${(value / max) * 100}%`,
                minHeight: value > 0 ? 2 : 0,
                background:
                  hover === i ? "var(--m-series)" : "rgba(57, 135, 229, 0.55)",
                borderRadius: "3px 3px 0 0",
              }}
            />
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 10,
          color: "var(--m-ink-3)",
          marginTop: 6,
        }}
      >
        <span>{startLabel}</span>
        <span>{endLabel}</span>
      </div>

      {hover !== null ? (
        <div
          style={{
            position: "absolute",
            left: `${((hover + 0.5) / values.length) * 100}%`,
            top: 0,
            transform:
              hover < values.length * 0.15
                ? "translateX(0)"
                : hover > values.length * 0.85
                  ? "translateX(-100%)"
                  : "translateX(-50%)",
            pointerEvents: "none",
            background: "var(--m-elevated)",
            border: "1px solid var(--m-line)",
            borderRadius: 7,
            padding: "6px 9px",
            fontSize: 11.5,
            lineHeight: 1.5,
            whiteSpace: "nowrap",
          }}
        >
          {renderTooltip(hover)}
        </div>
      ) : null}
    </div>
  );
}
