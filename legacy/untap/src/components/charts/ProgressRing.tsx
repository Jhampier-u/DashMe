type Props = {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
};

/** Anillo de progreso. Decorativo: la cifra siempre va escrita al lado. */
export function ProgressRing({ value, max, size = 66, stroke = 5 }: Props) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = max === 0 ? 0 : Math.min(1, Math.max(0, value / max));
  const center = size / 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="var(--m-track)"
        strokeWidth={stroke}
      />
      {ratio > 0 ? (
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--m-series)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(circumference * ratio).toFixed(2)} ${circumference.toFixed(2)}`}
          transform={`rotate(-90 ${center} ${center})`}
        />
      ) : null}
    </svg>
  );
}
