import Link from "next/link";

type Tile = { label: string; valor: string };

/**
 * Cabecera común a las fichas de artista, canción y álbum.
 *
 * Las tres muestran lo mismo —posición, título, y cuatro cifras— y solo
 * cambian el subtítulo y de dónde vienen los datos. Tenerlo una vez evita que
 * las tres se separen visualmente con el tiempo.
 */
export default function EntityHeader({
  posicion,
  contexto,
  titulo,
  subtitulo,
  subtituloHref,
  tiles,
}: {
  posicion: number | null;
  contexto: string;
  titulo: string;
  subtitulo?: string;
  subtituloHref?: string;
  tiles: Tile[];
}) {
  // La consulta de ranking mira los 1000 primeros; más allá no se conoce.
  const puesto = posicion === null ? "fuera del top 1000" : `#${posicion}`;

  return (
    <>
      <section className="px-8 pt-16 pb-12 hairline-b">
        <p className="label-mono text-tinta mb-6">
          {puesto} en tu ranking · {contexto}
        </p>

        <h1
          className="display-italic text-[clamp(0.96rem,3.2vw,2.4rem)] break-words"
          style={{ fontVariationSettings: '"opsz" 144, "SOFT" 0, "WONK" 1' }}
        >
          {titulo}
        </h1>

        {subtitulo && (
          <p className="font-serif italic text-xl text-cream-dim mt-5">
            {subtituloHref ? (
              <Link
                href={subtituloHref}
                className="hover:underline transition-colors"
              >
                {subtitulo}
              </Link>
            ) : (
              subtitulo
            )}
          </p>
        )}
      </section>

      <section className="hairline-b">
        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-rule">
          {tiles.map((t, i) => (
            <div
              key={t.label}
              className="bg-ink px-5 py-6 fade-in"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <dt className="label-mono text-mute mb-3">{t.label}</dt>
              <dd className="num-tabular text-[clamp(0.48rem,0.96vw,0.68rem)] leading-tight">
                {t.valor}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}
