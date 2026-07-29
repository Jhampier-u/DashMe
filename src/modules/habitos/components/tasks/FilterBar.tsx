import Link from "next/link";
import { varColor } from "@/modules/core/ui/paleta";
import type { Categoria } from "@/modules/habitos/lib/categorias";
import {
  PRIORIDADES,
  PRIORIDAD_DEFS,
  prioridadColorVar,
  type Prioridad,
} from "@/modules/habitos/lib/prioridad";
import type { TaskFilter } from "@/modules/habitos/lib/tasks";
import { CategoriesPanel } from "./CategoriesPanel";

/*
  Los filtros son ENLACES y no botones. Cambiar de filtro es cambiar de URL, y
  un enlace ya sabe hacer eso: se puede abrir en otra pestaña, se puede copiar,
  y «atrás» funciona sin escribir una línea de historial a mano.
*/
const CHIP =
  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-control " +
  "border-3 border-line text-tinta font-cuerpo text-xs no-underline " +
  "transition-[transform,box-shadow] duration-75 ease-out " +
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-line";

function href(filtro: TaskFilter, cambio: Partial<TaskFilter>): string {
  const f = { ...filtro, ...cambio };
  const p = new URLSearchParams();
  if (f.categoriaId) p.set("cat", f.categoriaId);
  if (f.prioridad) p.set("pri", f.prioridad);
  const q = p.toString();
  return q ? `/tareas?${q}` : "/tareas";
}

export function FilterBar({
  categorias,
  filtro,
}: {
  categorias: Categoria[];
  filtro: TaskFilter;
}) {
  const hayFiltro = filtro.categoriaId !== null || filtro.prioridad !== null;

  return (
    <div
      style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}
    >
      {PRIORIDADES.map((p: Prioridad) => {
        const activo = filtro.prioridad === p;
        return (
          <Link
            key={p}
            href={href(filtro, { prioridad: activo ? null : p })}
            aria-current={activo ? "true" : undefined}
            className={CHIP}
            style={{
              background: activo ? prioridadColorVar(p) : "var(--color-paper)",
              boxShadow: activo ? "var(--shadow-hard)" : "none",
            }}
          >
            <span
              style={{
                width: PRIORIDAD_DEFS[p].punto,
                height: PRIORIDAD_DEFS[p].punto,
                borderRadius: 999,
                background: prioridadColorVar(p),
                border: "2px solid var(--color-line)",
                flexShrink: 0,
              }}
            />
            {PRIORIDAD_DEFS[p].label}
          </Link>
        );
      })}

      {categorias.map((c) => {
        const activo = filtro.categoriaId === c.id;
        return (
          <Link
            key={c.id}
            href={href(filtro, { categoriaId: activo ? null : c.id })}
            aria-current={activo ? "true" : undefined}
            className={CHIP}
            style={{
              background: activo ? varColor(c.color) : "var(--color-paper)",
              boxShadow: activo ? "var(--shadow-hard)" : "none",
              // El filo lleva el color aunque el chip esté apagado: es lo que
              // permite reconocer la categoría sin tener que activarla.
              borderBottom: `3px solid ${varColor(c.color)}`,
            }}
          >
            {c.name}
          </Link>
        );
      })}

      {hayFiltro ? (
        <Link href="/tareas" className={`${CHIP} bg-paper-2`}>
          ✕ Quitar filtros
        </Link>
      ) : null}

      <CategoriesPanel categorias={categorias} />
    </div>
  );
}
