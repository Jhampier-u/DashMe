type Bucket = { date: string; plays: number; ms: number };

const CELDA = 9;
const HUECO = 2;
const PASO = CELDA + HUECO;
const MARGEN_IZQ = 22;

const DIAS_CORTOS = ["L", "", "X", "", "V", "", "D"];

/** Día de la semana con lunes = 0, sobre una fecha 'YYYY-MM-DD'. */
function diaSemana(fecha: string): number {
  const [y, m, d] = fecha.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

/** Semanas transcurridas desde el primer lunes anterior al 1 de enero. */
function semanaDelAnio(fecha: string, anio: number): number {
  const [y, m, d] = fecha.split("-").map(Number);
  const dia = Date.UTC(y, m - 1, d);
  const eneroUno = Date.UTC(anio, 0, 1);
  const offset = diaSemana(`${anio}-01-01`);
  return Math.floor((dia - eneroUno + offset * 86_400_000) / (7 * 86_400_000));
}

/**
 * Un año por tira: 53 semanas de ancho, 7 días de alto.
 *
 * Se dibuja solo lo que tiene actividad. La rejilla completa de ocho años son
 * casi tres mil celdas, y pintar las vacías una por una no aporta nada: el
 * fondo ya comunica el hueco.
 */
export default function CalendarHeatmap({ buckets }: { buckets: Bucket[] }) {
  if (buckets.length === 0) return null;

  const max = Math.max(...buckets.map((b) => b.plays));
  const porAnio = new Map<number, Bucket[]>();

  for (const b of buckets) {
    const anio = Number(b.date.slice(0, 4));
    if (!porAnio.has(anio)) porAnio.set(anio, []);
    porAnio.get(anio)!.push(b);
  }

  const anios = [...porAnio.keys()].sort((a, b) => b - a);
  const ancho = MARGEN_IZQ + 54 * PASO;
  const alto = 7 * PASO;

  const total = buckets.reduce((n, b) => n + b.plays, 0);
  const mejor = buckets.reduce((a, b) => (b.plays > a.plays ? b : a), buckets[0]);

  return (
    <section>
      <div className="flex items-baseline justify-between mb-5 flex-wrap gap-2">
        <p className="label-mono text-mute">
          {buckets.length.toLocaleString("es")} días con música
        </p>
        <p className="label-mono text-mute">
          tu mejor día · <span className="text-acid">{mejor.date}</span> ·{" "}
          {mejor.plays.toLocaleString("es")} escuchas
        </p>
      </div>

      <div className="overflow-x-auto">
        <div className="flex flex-col gap-3 min-w-[640px]">
          {anios.map((anio) => (
            <div key={anio} className="flex items-center gap-3">
              <span className="label-mono text-mute num-tabular w-9 shrink-0">
                {anio}
              </span>

              <svg
                viewBox={`0 0 ${ancho} ${alto}`}
                className="flex-1 h-[77px]"
                role="img"
                aria-label={`Actividad diaria de ${anio}`}
              >
                {DIAS_CORTOS.map((d, i) =>
                  d ? (
                    <text
                      key={i}
                      x={0}
                      y={i * PASO + CELDA - 1}
                      className="fill-mute font-mono"
                      style={{ fontSize: 7 }}
                    >
                      {d}
                    </text>
                  ) : null,
                )}

                {porAnio.get(anio)!.map((b) => {
                  const intensidad = Math.min(1, b.plays / max);
                  // Cinco escalones: un degradado continuo sobre celdas de
                  // nueve píxeles no se distingue, y sí ensucia la lectura.
                  const nivel = Math.ceil(intensidad * 4) || 1;
                  return (
                    <rect
                      key={b.date}
                      x={MARGEN_IZQ + semanaDelAnio(b.date, anio) * PASO}
                      y={diaSemana(b.date) * PASO}
                      width={CELDA}
                      height={CELDA}
                      rx={1.5}
                      className="fill-acid"
                      opacity={0.18 + nivel * 0.205}
                    >
                      <title>
                        {b.date} · {b.plays} escuchas ·{" "}
                        {Math.round(b.ms / 60000)} min
                      </title>
                    </rect>
                  );
                })}
              </svg>
            </div>
          ))}
        </div>
      </div>

      <p className="label-mono text-mute mt-4">
        {total.toLocaleString("es")} escuchas en {anios.length}{" "}
        {anios.length === 1 ? "año" : "años"}
      </p>
    </section>
  );
}
