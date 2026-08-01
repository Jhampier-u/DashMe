import { parseSprite, rectsDe } from "./rejilla";

/**
 * Pinta una rejilla de texto como SVG.
 *
 * `shapeRendering="crispEdges"` es lo que lo hace pixel art de verdad: sin él, el
 * navegador suaviza los bordes de cada rectángulo y el dibujo pierde el filo que
 * es todo el punto del estilo.
 *
 * `label` NO es opcional. Un sprite es información —qué especie, qué etapa, en
 * qué estado— y sin él la planta no existe para un lector de pantalla. Si de
 * verdad es decorativo, pásale cadena vacía a propósito.
 */
export function Sprite({
  grid,
  size,
  label,
  className,
}: {
  grid: string;
  /** Lado en píxeles de pantalla. La rejilla se escala para llenarlo. */
  size: number;
  label: string;
  className?: string;
}) {
  const sprite = parseSprite(grid);
  if (sprite.ancho === 0) return null;

  const rects = rectsDe(sprite);
  const decorativo = label === "";

  return (
    <svg
      width={size}
      height={(size * sprite.alto) / sprite.ancho}
      viewBox={`0 0 ${sprite.ancho} ${sprite.alto}`}
      shapeRendering="crispEdges"
      className={className}
      role={decorativo ? undefined : "img"}
      aria-label={decorativo ? undefined : label}
      aria-hidden={decorativo ? true : undefined}
      focusable="false"
    >
      {rects.map((r, i) => (
        <rect
          key={i}
          x={r.x}
          y={r.y}
          width={r.ancho}
          height={1}
          fill={r.color}
        />
      ))}
    </svg>
  );
}
