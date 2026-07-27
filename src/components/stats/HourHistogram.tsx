type Bucket = { hour: number; plays: number; ms: number };

/**
 * Histograma en SVG a mano.
 *
 * El proyecto no usa librerías de gráficas por decisión explícita, y para
 * veinticuatro barras no hacen falta: son cuatro líneas de SVG y se controla
 * exactamente cómo se ve.
 */
export default function HourHistogram({ buckets }: { buckets: Bucket[] }) {
  const max = Math.max(1, ...buckets.map((b) => b.plays));

  return (
    <section>
      <p className="label-mono text-mute mb-4">A qué hora escuchas</p>

      <svg viewBox="0 0 240 60" className="w-full h-24" role="img"
           aria-label="Reproducciones por hora del día">
        {buckets.map((b) => (
          <rect
            key={b.hour}
            x={b.hour * 10 + 1}
            y={50 - (b.plays / max) * 46}
            width={8}
            height={Math.max(0.5, (b.plays / max) * 46)}
            className="fill-acid"
          />
        ))}
        {[0, 6, 12, 18].map((h) => (
          <text
            key={h}
            x={h * 10 + 5}
            y={58}
            textAnchor="middle"
            className="fill-mute"
            style={{ fontSize: 5 }}
          >
            {h}h
          </text>
        ))}
      </svg>
    </section>
  );
}
