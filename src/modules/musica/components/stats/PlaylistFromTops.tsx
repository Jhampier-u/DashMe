"use client";

import { useState, useTransition } from "react";
import {
  crearPlaylistDesdeTops,
  type ResultadoPlaylist,
} from "@/modules/musica/lib/playlist-from-tops-actions";

/**
 * Crea en Spotify una playlist con los tops del rango que se esté mirando.
 *
 * El rango viaja como parámetros y no como objeto ya resuelto: la acción es un
 * endpoint público y debe recalcularlo por su cuenta en vez de fiarse de lo
 * que le manden.
 */
export default function PlaylistFromTops({
  rangeParams,
  etiqueta,
}: {
  rangeParams: { preset?: string; desde?: string; hasta?: string };
  etiqueta: string;
}) {
  const [pendiente, startTransition] = useTransition();
  const [resultado, setResultado] = useState<ResultadoPlaylist | null>(null);

  const crear = () => {
    startTransition(async () => {
      setResultado(
        await crearPlaylistDesdeTops(
          rangeParams.preset,
          rangeParams.desde,
          rangeParams.hasta,
        ),
      );
    });
  };

  return (
    <section>
      <p className="label-mono text-mute mb-5">Llevártelo a Spotify</p>

      <div className="flex items-center gap-4 flex-wrap">
        <button
          type="button"
          onClick={crear}
          disabled={pendiente}
          className="label-mono border border-current px-4 py-2 disabled:opacity-50"
        >
          {pendiente
            ? "Creando en Spotify…"
            : `Crear playlist con tu top de ${etiqueta.toLowerCase()}`}
        </button>

        {resultado?.error && (
          <span className="label-mono text-blood">{resultado.error}</span>
        )}

        {resultado && !resultado.error && (
          <span className="label-mono text-acid">
            {resultado.canciones} canciones ·{" "}
            {resultado.url ? (
              <a
                href={resultado.url}
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-cream transition-colors"
              >
                abrir en Spotify ↗
              </a>
            ) : (
              "creada"
            )}
          </span>
        )}
      </div>

      <p className="label-mono text-mute mt-4">
        Se crea privada, con hasta 50 canciones. Las escuchas sin identificador
        de Spotify quedan fuera.
      </p>
    </section>
  );
}
