"use client";

// Gráfico de línea genérico: no sabe nada del dominio, solo dibuja series de
// números. Todo lo que se lee en pantalla llega por props (labels, aria,
// tooltip); así sirve luego para tareas y proyectos sin tocarlo.

import { useState, type ReactNode } from "react";
import { areaPath, invertLinear, linePath, scaleLinear, segments, type Point } from "@/modules/habitos/lib/chart";
import { ChartTooltip } from "./ChartTooltip";

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

  // Misma escala X que la cruceta del SVG: si difiriera, la cruceta y el
  // tooltip señalarían días distintos al pasar el ratón.
  const tooltipLeft = activeIndex === null ? 0 : (x(activeIndex) / W) * 100;

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
            {/* Discontinua: es guía, no dato. */}
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(value)}
              y2={y(value)}
              stroke="var(--color-line)"
              strokeWidth={2}
              strokeDasharray="4 4"
            />
            {/* Quicksand y no VT323: a 11px la pixelada está bajo su suelo. */}
            <text
              x={PAD.left - 8}
              y={y(value) + 4}
              textAnchor="end"
              fontSize={11}
              fontFamily="var(--font-cuerpo)"
              fill="var(--color-tinta)"
            >
              {formatTick(value)}
            </text>
          </g>
        ))}

        {/* El área es superficie, así que va en pastel macizo. */}
        {lineSegments.map((seg, i) => (
          <path key={`area-${i}`} d={areaPath(seg, y(0))} fill="var(--color-sky)" />
        ))}
        {/* La línea ES el dato, así que va en tinta: un trazo fino en pastel
            sobre papel no se sostiene, y oscurecerlo lo sacaría de la paleta. */}
        {lineSegments.map((seg, i) => (
          <path
            key={`line-${i}`}
            d={linePath(seg)}
            fill="none"
            stroke="var(--color-tinta)"
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {dots?.map((value, i) =>
          value === null ? null : highlighted?.[i] ? (
            // El día con escudo sigue siendo un ANILLO y no un disco: es lo que
            // lo distingue sin depender del color. Solo cambia el tono.
            <circle
              key={i}
              cx={x(i)}
              cy={y(value)}
              r={4}
              fill="var(--color-peach)"
              stroke="var(--color-tinta)"
              strokeWidth={2}
            />
          ) : (
            <circle key={i} cx={x(i)} cy={y(value)} r={2.5} fill="var(--color-tinta)" />
          ),
        )}

        {activeIndex !== null ? (
          <g>
            <line
              x1={x(activeIndex)}
              x2={x(activeIndex)}
              y1={PAD.top}
              y2={H - PAD.bottom}
              stroke="var(--color-line)"
              strokeWidth={2}
              strokeDasharray="4 4"
            />
            {line[activeIndex] === null ? null : (
              <circle
                cx={x(activeIndex)}
                cy={y(line[activeIndex] as number)}
                r={5}
                fill="var(--color-tinta)"
                stroke="var(--color-paper)"
                strokeWidth={2}
              />
            )}
          </g>
        ) : null}

        <text
          x={PAD.left}
          y={H - 6}
          fontSize={11}
          fontFamily="var(--font-cuerpo)"
          fill="var(--color-tinta)"
        >
          {startLabel}
        </text>
        <text
          x={W - PAD.right}
          y={H - 6}
          fontSize={11}
          fontFamily="var(--font-cuerpo)"
          fill="var(--color-tinta)"
          textAnchor="end"
        >
          {endLabel}
        </text>
      </svg>

      {activeIndex !== null ? (
        <ChartTooltip left={tooltipLeft}>{renderTooltip(activeIndex)}</ChartTooltip>
      ) : null}
    </div>
  );
}
