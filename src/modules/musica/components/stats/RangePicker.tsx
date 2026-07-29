import Link from "next/link";
import { PRESETS, type StatsRange } from "@/modules/musica/lib/stats/range";

/**
 * El rango vive en la URL, así que el selector son enlaces, no estado.
 *
 * Nada de JavaScript de cliente: cada opción es un `<Link>` que recarga la
 * página con otro `?preset=`. El botón atrás funciona y la vista se puede
 * marcar como favorita.
 *
 * `base` es la ruta sobre la que se navega y **no tiene valor por defecto a
 * propósito**. Lo tuvo, `"/"`, y era una trampa: la portada de música se
 * olvidaba de pasarlo y cambiar de rango allí te echaba al inicio del
 * dashboard. Un defecto plausible convierte un olvido en un fallo silencioso;
 * sin él, TypeScript lo caza al escribirlo.
 */
export default function RangePicker({
  range,
  base,
}: {
  range: StatsRange;
  base: string;
}) {
  return (
    <nav className="flex flex-wrap items-center gap-2">
      {Object.entries(PRESETS).map(([id, { label }]) => {
        const activo = range.preset === id;
        return (
          <Link
            key={id}
            href={`${base}?preset=${id}`}
            aria-current={activo ? "page" : undefined}
            /*
              El activo se marca con relleno, no con tinte. Antes iba en acid
              contra mute, y al pasar los dos a tinta la distinción desaparecía:
              todos los rangos se veían igual. Es el mismo recurso que la
              navegación del armazón y las columnas de tareas.
            */
            className={
              activo
                ? "label-mono px-2.5 py-1 border-2 border-line bg-pink text-tinta font-bold"
                : "label-mono px-2.5 py-1 border-2 border-transparent text-tinta hover:underline"
            }
          >
            {label}
          </Link>
        );
      })}
      <span className="label-mono text-mute ml-2">
        {range.fromDate} → {range.toDate}
      </span>
    </nav>
  );
}
