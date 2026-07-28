import Link from "next/link";
import { PRESETS, type StatsRange } from "@/lib/stats/range";

/**
 * El rango vive en la URL, así que el selector son enlaces, no estado.
 *
 * Nada de JavaScript de cliente: cada opción es un `<Link>` que recarga la
 * página con otro `?preset=`. El botón atrás funciona y la vista se puede
 * marcar como favorita.
 *
 * `base` es la ruta sobre la que se navega. Sin ella el selector devolvía
 * siempre a la portada, así que cambiar de rango desde el historial o desde
 * una ficha te sacaba de donde estabas.
 */
export default function RangePicker({
  range,
  base = "/",
}: {
  range: StatsRange;
  base?: string;
}) {
  return (
    <nav className="flex flex-wrap items-center gap-4">
      {Object.entries(PRESETS).map(([id, { label }]) => (
        <Link
          key={id}
          href={`${base}?preset=${id}`}
          className={`label-mono transition-colors ${
            range.preset === id ? "text-acid" : "text-mute hover:text-cream"
          }`}
        >
          {label}
        </Link>
      ))}
      <span className="label-mono text-mute">
        {range.fromDate} → {range.toDate}
      </span>
    </nav>
  );
}
