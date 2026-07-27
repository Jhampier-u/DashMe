"use client";

// Gráfico de línea genérico: no sabe nada del dominio, solo dibuja series de
// números. Todo lo que se lee en pantalla llega por props (labels, aria,
// tooltip); así sirve luego para tareas y proyectos sin tocarlo.

import { useState, type ReactNode } from "react";
import { areaPath, invertLinear, linePath, scaleLinear, segments, type Point } from "@/lib/chart";

export type LineChartProps = {
  /** Serie principal (la que se dibuja como línea y área). `null` = hueco. */
  line: (number | null)[];
  /** Puntos sueltos opcionales bajo la línea. `null` = sin punto ese día. */
  dots?: (number | null)[];
  /** Índices a destacar con un anillo en color de aviso. */
  highlighted?: boolean[];
  /** Dominio vertical. Por defecto [0, 1]. */
  domain?: [number, number];
  /** Valores del eje Y a rotular, en unidades del dominio. */
  ticks?: number[];
  /** Cómo se escribe cada marca del eje. Por defecto, el número tal cual. */
  formatTick?: (value: number) => string;
  startLabel: string;
  endLabel: string;
  ariaLabel: string;
  /** Contenido del tooltip para el índice sobre el que está el ratón. */
  renderTooltip: (index: number) => ReactNode;
};

const W = 560;
const H = 190;
const PAD = { left: 32, right: 14, top: 12, bottom: 26 };

export function LineChart({
  line,
  dots,
  highlighted,
  domain = [0, 1],
  ticks = [],
  formatTick = (value) => `${value}`,
  startLabel,
  endLabel,
  ariaLabel,
  renderTooltip,
}: LineChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  if (line.length === 0) return null;

  const xDomain: [number, number] = [0, Math.max(1, line.length - 1)];
  const xRange: [number, number] = [PAD.left, W - PAD.right];
  const x = scaleLinear(xDomain, xRange);
  const xInverse = invertLinear(xDomain, xRange);
  const y = scaleLinear(domain, [H - PAD.bottom, PAD.top]);

  const lineSegments = segments(line).map((seg) =>
    seg.values.map((value, i): Point => ({ x: x(seg.start + i), y: y(value) })),
  );

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - box.left) / box.width;
    // El ratio es una fracción del SVG completo (viewBox 0..W); hay que
    // pasarlo primero a coordenada del viewBox y luego invertir la misma
    // escala X que usa el trazado, porque el dominio no arranca en el borde
    // (PAD.left) ni termina en él (W - PAD.right).
    const viewBoxX = ratio * W;
    const index = Math.round(xInverse(viewBoxX));
    setHover(Math.min(line.length - 1, Math.max(0, index)));
  }

  // Índice activo ya acotado: evita la aserción no nula `hover!` más abajo.
  const activeIndex = hover === null ? null : Math.min(line.length - 1, Math.max(0, hover));

  return (
    <div style={{ position: "relative" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label={ariaLabel}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((value) => (
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
              {formatTick(value)}
            </text>
          </g>
        ))}

        {lineSegments.map((seg, i) => (
          <path key={`area-${i}`} d={areaPath(seg, y(0))} fill="var(--m-series)" fillOpacity={0.1} />
        ))}
        {lineSegments.map((seg, i) => (
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

        {dots?.map((value, i) =>
          value === null ? null : highlighted?.[i] ? (
            <circle key={i} cx={x(i)} cy={y(value)} r={3.5} fill="none" stroke="var(--m-warn)" strokeWidth={1.6} />
          ) : (
            <circle key={i} cx={x(i)} cy={y(value)} r={2.5} fill="var(--m-series)" fillOpacity={0.45} />
          ),
        )}

        {activeIndex !== null ? (
          <g>
            <line
              x1={x(activeIndex)}
              x2={x(activeIndex)}
              y1={PAD.top}
              y2={H - PAD.bottom}
              stroke="var(--m-ink-3)"
              strokeWidth={1}
            />
            {line[activeIndex] === null ? null : (
              <circle
                cx={x(activeIndex)}
                cy={y(line[activeIndex] as number)}
                r={4}
                fill="var(--m-series)"
                stroke="var(--m-surface)"
                strokeWidth={2}
              />
            )}
          </g>
        ) : null}

        <text x={PAD.left} y={H - 6} fontSize={10} fill="var(--m-ink-3)">
          {startLabel}
        </text>
        <text x={W - PAD.right} y={H - 6} fontSize={10} fill="var(--m-ink-3)" textAnchor="end">
          {endLabel}
        </text>
      </svg>

      {activeIndex !== null ? (
        <div
          style={{
            position: "absolute",
            // Misma escala X que la cruceta del SVG: si difiriera, la cruceta
            // y el tooltip señalarían días distintos al pasar el mouse.
            left: `${(x(activeIndex) / W) * 100}%`,
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
          {renderTooltip(activeIndex)}
        </div>
      ) : null}
    </div>
  );
}
