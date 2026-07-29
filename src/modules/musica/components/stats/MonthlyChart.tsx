type Bucket = { month: string; plays: number; ms: number };

const ANCHO = 720;
const ALTO = 150;
const MARGEN = 10;

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function etiqueta(month: string): string {
  const [anio, mes] = month.split("-");
  return `${MESES[Number(mes) - 1]} ${anio.slice(2)}`;
}

/**
 * Evolución mes a mes como área.
 *
 * Se dibuja a mano en SVG porque el proyecto no usa librerías de gráficas y
 * para una serie de una sola dimensión no hacen falta: son dos rutas, el área
 * y su contorno.
 *
 * Con un único mes el área degeneraría en una línea vertical invisible, así que
 * ese caso se resuelve con una barra.
 */
export default function MonthlyChart({ buckets }: { buckets: Bucket[] }) {
  if (buckets.length === 0) return null;

  const max = Math.max(1, ...buckets.map((b) => b.plays));
  const pico = buckets.reduce((a, b) => (b.plays > a.plays ? b : a), buckets[0]);
  const util = ALTO - MARGEN * 2;

  const y = (plays: number) => MARGEN + util - (plays / max) * util;
  const x = (i: number) =>
    buckets.length === 1 ? ANCHO / 2 : (i / (buckets.length - 1)) * ANCHO;

  const puntos = buckets.map((b, i) => `${x(i)},${y(b.plays)}`).join(" ");
  const area = `M0,${ALTO} L${puntos.replaceAll(" ", " L")} L${ANCHO},${ALTO} Z`;

  return (
    <section>
      <div className="flex items-baseline justify-between mb-4">
        <p className="label-mono text-mute">Mes a mes</p>
        <p className="label-mono text-mute">
          pico · <span className="text-tinta">{etiqueta(pico.month)}</span> ·{" "}
          {pico.plays.toLocaleString("es")}
        </p>
      </div>

      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        preserveAspectRatio="none"
        className="w-full h-[150px]"
        role="img"
        aria-label={`Reproducciones por mes. Máximo en ${etiqueta(pico.month)}.`}
      >
        {buckets.length === 1 ? (
          <rect
            x={ANCHO / 2 - 20}
            y={y(buckets[0].plays)}
            width={40}
            height={ALTO - y(buckets[0].plays)}
            className="fill-acid/30"
          />
        ) : (
          <>
            <path d={area} className="fill-acid/12" />
            <polyline
              points={puntos}
              className="fill-none stroke-acid"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}

        {buckets.map((b, i) => (
          <circle
            key={b.month}
            cx={x(i)}
            cy={y(b.plays)}
            r={b.month === pico.month ? 3.5 : 1.5}
            className={b.month === pico.month ? "fill-acid" : "fill-cream-dim"}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      <div className="flex justify-between mt-2">
        <span className="label-mono text-mute">{etiqueta(buckets[0].month)}</span>
        <span className="label-mono text-mute">
          {etiqueta(buckets[buckets.length - 1].month)}
        </span>
      </div>
    </section>
  );
}
