type Bucket = { hour: number; plays: number; ms: number };

const TAMANO = 260;
const CENTRO = TAMANO / 2;
const RADIO_INTERIOR = 46;
const RADIO_EXTERIOR = 112;

/** 0h arriba: se resta un cuarto de vuelta al ángulo. */
function punto(hora: number, radio: number) {
  const angulo = (hora / 24) * Math.PI * 2 - Math.PI / 2;
  return {
    x: CENTRO + Math.cos(angulo) * radio,
    y: CENTRO + Math.sin(angulo) * radio,
  };
}

/**
 * Las 24 horas del día como radios de un reloj.
 *
 * Un histograma de barras obliga a leer el eje para entender que las 3 de la
 * madrugada están al lado de las 23:00. En un círculo esa continuidad es
 * evidente: la madrugada y la noche se tocan, que es como funciona un día.
 */
export default function HourClock({ buckets }: { buckets: Bucket[] }) {
  const max = Math.max(1, ...buckets.map((b) => b.plays));
  const pico = buckets.reduce((a, b) => (b.plays > a.plays ? b : a), buckets[0]);
  const total = buckets.reduce((n, b) => n + b.plays, 0);

  return (
    <figure className="flex flex-col items-center gap-4">
      <svg
        viewBox={`0 0 ${TAMANO} ${TAMANO}`}
        className="w-full max-w-[260px]"
        role="img"
        aria-label={`Reproducciones por hora del día. Máximo a las ${pico.hour}h.`}
      >
        {/* Circunferencia de referencia */}
        <circle
          cx={CENTRO}
          cy={CENTRO}
          r={RADIO_EXTERIOR}
          className="fill-none stroke-rule"
          strokeWidth={1}
        />
        <circle
          cx={CENTRO}
          cy={CENTRO}
          r={RADIO_INTERIOR}
          className="fill-none stroke-rule"
          strokeWidth={1}
        />

        {buckets.map((b) => {
          const largo =
            RADIO_INTERIOR +
            (b.plays / max) * (RADIO_EXTERIOR - RADIO_INTERIOR);
          const a = punto(b.hour, RADIO_INTERIOR);
          const z = punto(b.hour, Math.max(RADIO_INTERIOR + 1.5, largo));
          const esPico = b.hour === pico.hour && b.plays > 0;

          return (
            <line
              key={b.hour}
              x1={a.x}
              y1={a.y}
              x2={z.x}
              y2={z.y}
              strokeWidth={7}
              strokeLinecap="round"
              className={esPico ? "stroke-acid" : "stroke-cream-dim"}
              opacity={esPico ? 1 : 0.28 + (b.plays / max) * 0.5}
            />
          );
        })}

        {[0, 6, 12, 18].map((h) => {
          const p = punto(h, RADIO_EXTERIOR + 14);
          return (
            <text
              key={h}
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-mute font-mono"
              style={{ fontSize: 9, letterSpacing: "0.1em" }}
            >
              {String(h).padStart(2, "0")}
            </text>
          );
        })}

        {total > 0 && (
          <>
            <text
              x={CENTRO}
              y={CENTRO - 4}
              textAnchor="middle"
              className="fill-acid num-tabular"
              style={{ fontSize: 26, fontWeight: 600 }}
            >
              {String(pico.hour).padStart(2, "0")}
            </text>
            <text
              x={CENTRO}
              y={CENTRO + 12}
              textAnchor="middle"
              className="fill-mute font-mono"
              style={{ fontSize: 7, letterSpacing: "0.14em" }}
            >
              TU HORA
            </text>
          </>
        )}
      </svg>
    </figure>
  );
}
