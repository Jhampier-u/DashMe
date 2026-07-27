// Helpers de trazado SVG. No saben nada del dominio: reciben números.

export type Point = { x: number; y: number };

/** Escala lineal de un dominio a un rango. El rango puede ir al revés. */
export function scaleLinear(
  domain: [number, number],
  range: [number, number],
): (value: number) => number {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0;
  if (span === 0) return () => r0;
  return (value) => r0 + ((value - d0) / span) * (r1 - r0);
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function linePath(points: Point[]): string {
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"}${round(p.x)} ${round(p.y)}`)
    .join(" ");
}

/** La misma línea, cerrada contra una base horizontal. */
export function areaPath(points: Point[], baselineY: number): string {
  if (points.length === 0) return "";
  const first = points[0];
  const last = points[points.length - 1];
  return [
    linePath(points),
    `L${round(last.x)} ${round(baselineY)}`,
    `L${round(first.x)} ${round(baselineY)}`,
    "Z",
  ].join(" ");
}

/**
 * Parte una serie con huecos en tramos continuos, conservando el índice de
 * inicio de cada uno. Así la línea se interrumpe en los días sin nada
 * programado en vez de bajar a cero.
 */
export function segments<T>(
  values: (T | null)[],
): { start: number; values: T[] }[] {
  const out: { start: number; values: T[] }[] = [];
  let current: { start: number; values: T[] } | null = null;

  values.forEach((value, i) => {
    if (value === null) {
      current = null;
      return;
    }
    if (!current) {
      const next = { start: i, values: [] as T[] };
      current = next;
      out.push(next);
    }
    current.values.push(value);
  });

  return out;
}
