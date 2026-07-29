"use client";

import { useState, type ReactNode } from "react";
import { ChartTooltip } from "./ChartTooltip";

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
          borderBottom: "3px solid var(--color-line)",
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
                // Relleno en pastel, contorno en tinta: la barra es superficie
                // y el borde es lo que la hace del sistema. Bajo el ratón se
                // invierte a tinta maciza, que no deja duda de cuál señalas.
                background: hover === i ? "var(--color-tinta)" : "var(--color-sky)",
                border: value > 0 ? "2px solid var(--color-line)" : "none",
                borderBottom: "none",
                borderRadius: "6px 6px 0 0",
              }}
            />
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontFamily: "var(--font-cuerpo)",
          fontSize: 11,
          color: "var(--color-tinta)",
          marginTop: 8,
        }}
      >
        <span>{startLabel}</span>
        <span>{endLabel}</span>
      </div>

      {hover !== null ? (
        <ChartTooltip left={((hover + 0.5) / values.length) * 100}>
          {renderTooltip(hover)}
        </ChartTooltip>
      ) : null}
    </div>
  );
}
