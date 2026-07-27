type Entrada = { key: string; name: string; plays: number; ms: number };

/**
 * Muestra siempre las dos cifras, reproducciones y minutos.
 *
 * Un ranking ordenado solo por una de ellas induce a error: un artista de temas
 * largos gana por tiempo y pierde por número de escuchas, y quien vea una sola
 * columna no sabrá por qué está donde está.
 */
export default function TopList({
  titulo,
  entradas,
  vacio,
}: {
  titulo: string;
  entradas: Entrada[];
  vacio: string;
}) {
  return (
    <section>
      <p className="label-mono text-mute mb-4">{titulo}</p>

      {entradas.length === 0 ? (
        <p className="font-serif italic text-cream-dim">{vacio}</p>
      ) : (
        <ol>
          {entradas.map((e, i) => (
            <li
              key={e.key}
              className="flex items-baseline justify-between gap-4 py-2 hairline-b"
            >
              <span className="flex items-baseline gap-3 min-w-0">
                <span className="label-mono text-mute num-tabular">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="truncate">{e.name}</span>
              </span>
              <span className="label-mono text-mute num-tabular whitespace-nowrap">
                {e.plays} · {Math.round(e.ms / 60000)} min
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
