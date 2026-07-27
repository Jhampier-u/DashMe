"use client";

import { useState } from "react";
import { areaPath, linePath, scaleLinear, segments, type Point } from "@/lib/chart";

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

const W = 560;
const H = 190;
const PAD = { left: 32, right: 14, top: 12, bottom: 26 };

const FORMATTER = new Intl.DateTimeFormat("es", { day: "numeric", month: "short" });

function label(iso: string): string {
  return FORMATTER.format(new Date(`${iso}T00:00:00Z`));
}

export function ComplianceChart({ points }: { points: ChartPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length === 0) return null;

  const x = scaleLinear([0, Math.max(1, points.length - 1)], [PAD.left, W - PAD.right]);
  const y = scaleLinear([0, 1], [H - PAD.bottom, PAD.top]);

  const meanSegments = segments(points.map((p) => p.mean)).map((seg) =>
    seg.values.map((value, i): Point => ({ x: x(seg.start + i), y: y(value) })),
  );

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - box.left) / box.width;
    const index = Math.round(ratio * (points.length - 1));
    setHover(Math.min(points.length - 1, Math.max(0, index)));
  }

  // Índice activo ya acotado: evita la aserción no nula `hover!` más abajo.
  const activeIndex = hover === null ? null : Math.min(points.length - 1, Math.max(0, hover));
  const active = activeIndex === null ? null : points[activeIndex];

  return (
    <div style={{ position: "relative" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label={`Cumplimiento diario de los últimos ${points.length} días con media móvil de 7 días.`}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {[0, 0.5, 1].map((value) => (
          <g key={value}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(value)}
              y2={y(value)}
              stroke="var(--m-line)"
              strokeWidth={1}
            />
            <text x={PAD.left - 8} y={y(value) + 4} textAnchor="end" fontSize={10} fill="var(--m-ink-3)">
              {Math.round(value * 100)}
            </text>
          </g>
        ))}

        {meanSegments.map((seg, i) => (
          <path key={`area-${i}`} d={areaPath(seg, y(0))} fill="var(--m-series)" fillOpacity={0.1} />
        ))}
        {meanSegments.map((seg, i) => (
          <path
            key={`line-${i}`}
            d={linePath(seg)}
            fill="none"
            stroke="var(--m-series)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {points.map((p, i) =>
          p.rate === null ? null : p.shielded > 0 ? (
            <circle
              key={p.date}
              cx={x(i)}
              cy={y(p.rate)}
              r={3.5}
              fill="none"
              stroke="var(--m-warn)"
              strokeWidth={1.6}
            />
          ) : (
            <circle key={p.date} cx={x(i)} cy={y(p.rate)} r={2.5} fill="var(--m-series)" fillOpacity={0.45} />
          ),
        )}

        {activeIndex !== null && active ? (
          <g>
            <line
              x1={x(activeIndex)}
              x2={x(activeIndex)}
              y1={PAD.top}
              y2={H - PAD.bottom}
              stroke="var(--m-ink-3)"
              strokeWidth={1}
            />
            {active.mean === null ? null : (
              <circle
                cx={x(activeIndex)}
                cy={y(active.mean)}
                r={4}
                fill="var(--m-series)"
                stroke="var(--m-surface)"
                strokeWidth={2}
              />
            )}
          </g>
        ) : null}

        <text x={PAD.left} y={H - 6} fontSize={10} fill="var(--m-ink-3)">
          {label(points[0].date)}
        </text>
        <text x={W - PAD.right} y={H - 6} fontSize={10} fill="var(--m-ink-3)" textAnchor="end">
          hoy
        </text>
      </svg>

      {active && activeIndex !== null ? (
        <div
          style={{
            position: "absolute",
            left: `${(activeIndex / Math.max(1, points.length - 1)) * 100}%`,
            top: 0,
            transform: "translateX(-50%)",
            pointerEvents: "none",
            background: "var(--m-elevated)",
            border: "1px solid var(--m-line)",
            borderRadius: 7,
            padding: "7px 10px",
            fontSize: 11.5,
            lineHeight: 1.5,
            whiteSpace: "nowrap",
          }}
        >
          <strong style={{ fontSize: 12.5 }}>{label(active.date)}</strong>
          <br />
          {active.mean === null ? "Sin datos" : `Media 7d: ${Math.round(active.mean * 100)}%`}
          <br />
          <span style={{ color: "var(--m-ink-3)" }}>
            {active.scheduled === 0
              ? "No tocaba nada"
              : `Ese día: ${active.done} de ${active.scheduled}`}
            {active.shielded > 0 ? ` · ${active.shielded} con escudo` : ""}
          </span>
        </div>
      ) : null}
    </div>
  );
}
