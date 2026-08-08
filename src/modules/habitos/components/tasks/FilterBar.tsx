import Link from "next/link";
import { varColor } from "@/modules/core/ui/paleta";
import type { Categoria } from "@/modules/habitos/lib/categorias";
import {
  PRIORIDADES,
  PRIORIDAD_DEFS,
  prioridadColorVar,
  type Prioridad,
} from "@/modules/habitos/lib/prioridad";
import type { Conteos, TaskFilter } from "@/modules/habitos/lib/tasks";
import { CategoriesPanel } from "./CategoriesPanel";

/*
  Los filtros son ENLACES y no botones. Cambiar de filtro es cambiar de URL, y
  un enlace ya sabe hacer eso: se puede abrir en otra pestaña, se puede copiar,
  y «atrás» funciona sin escribir una línea de historial a mano.

  LA BARRA VA POR GRUPOS, cada uno con su rótulo. Antes prioridades y categorías
  compartían una sola tira de píldoras idénticas, y se leían como una única
  lista. Baymard, que hace pruebas de usabilidad a gran escala, llama a agrupar
  por tipo «la columna vertebral de un panel legible».
*/
const CHIP =
  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-control " +
  "border-3 border-line text-tinta font-cuerpo text-xs no-underline " +
  "transition-[transform,box-shadow] duration-75 ease-out " +
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-line";

function url(f: TaskFilter): string {
  const p = new URLSearchParams();
  if (f.categoriaIds.length) p.set("cat", f.categoriaIds.join(","));
  if (f.prioridades.length) p.set("pri", f.prioridades.join(","));
  const q = p.toString();
  return q ? `/tareas?${q}` : "/tareas";
}

/** Quita el valor si está y lo añade si no: cada píldora es un interruptor. */
function alternar<T extends string>(lista: T[], v: T): T[] {
  return lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v];
}

const ROTULO: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  minWidth: "5.5rem",
};

/** Una fila con su rótulo. El rótulo ES lo que separa los dos grupos. */
function Grupo({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        alignItems: "center",
      }}
    >
      <span style={ROTULO}>{titulo}</span>
      {children}
    </div>
  );
}

/** El número entre paréntesis: cuántas verías si marcas esta opción. */
function Cuenta({ n }: { n: number }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-vt)",
        fontSize: 14,
        lineHeight: 1,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {n}
    </span>
  );
}

export function FilterBar({
  categorias,
  filtro,
  conteos,
}: {
  categorias: Categoria[];
  filtro: TaskFilter;
  conteos: Conteos;
}) {
  const activos = filtro.categoriaIds.length + filtro.prioridades.length;
  const nombreDe = new Map(categorias.map((c) => [c.id, c.name]));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <Grupo titulo="Prioridad">
        {PRIORIDADES.map((p: Prioridad) => {
          const activo = filtro.prioridades.includes(p);
          const n = conteos.prioridades[p] ?? 0;
          return (
            <Link
              key={p}
              href={url({
                ...filtro,
                prioridades: alternar(filtro.prioridades, p),
              })}
              aria-pressed={activo}
              className={CHIP}
              style={{
                background: activo
                  ? prioridadColorVar(p)
                  : "var(--color-paper)",
                boxShadow: activo ? "var(--shadow-hard)" : "none",
                // Sin filo de color. El punto ya distingue la prioridad, y el
                // rótulo del grupo dice de qué familia es esta píldora.
              }}
            >
              <span
                aria-hidden
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
              <Cuenta n={n} />
            </Link>
          );
        })}
      </Grupo>

      <Grupo titulo="Categoría">
        {categorias.map((c) => {
          const activo = filtro.categoriaIds.includes(c.id);
          const n = conteos.categorias[c.id] ?? 0;
          return (
            <Link
              key={c.id}
              href={url({
                ...filtro,
                categoriaIds: alternar(filtro.categoriaIds, c.id),
              })}
              aria-pressed={activo}
              className={CHIP}
              style={{
                background: activo ? varColor(c.color) : "var(--color-paper)",
                boxShadow: activo ? "var(--shadow-hard)" : "none",
              }}
            >
              {/*
                El color de la categoría iba en un filo bajo la píldora. Se ha
                quitado: ya vive donde tiene que vivir, subrayando el título de
                la tarea en el tablero. Repetirlo aquí era lo que hacía que las
                dos familias de píldora se leyeran como una sola.

                Un punto, no un filo: la misma forma que la prioridad, para que
                lo que separe los grupos sea el rótulo y no el adorno.
              */}
              <span
                aria-hidden
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: varColor(c.color),
                  border: "2px solid var(--color-line)",
                  flexShrink: 0,
                }}
              />
              {c.name}
              <Cuenta n={n} />
            </Link>
          );
        })}
        <CategoriesPanel categorias={categorias} />
      </Grupo>

      {activos > 0 ? (
        /*
          LOS FILTROS PUESTOS, COMO OBJETOS QUE SE PUEDEN QUITAR.

          Este patrón está consolidado en comercio electrónico y NO existe en
          ninguna app de tareas personal de las revisadas: Todoist, Things y
          TickTick enseñan el nombre de una vista guardada, no las condiciones.
          El resultado allí es que el estado del filtro es opaco y solo se
          deshace saliendo de la vista entera.

          Cada chip lleva su faceta delante —«Prioridad: Alto»— porque la misma
          palabra puede aparecer en dos grupos y sin el prefijo no se sabe cuál
          estás quitando.
        */
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
            paddingTop: 6,
            borderTop: "3px solid var(--color-line)",
          }}
        >
          <span style={ROTULO}>Puestos</span>
          {filtro.prioridades.map((p) => (
            <Link
              key={`a-${p}`}
              href={url({
                ...filtro,
                prioridades: alternar(filtro.prioridades, p),
              })}
              className={`${CHIP} bg-paper-2`}
              aria-label={`Quitar el filtro de prioridad ${PRIORIDAD_DEFS[p].label}`}
            >
              Prioridad: {PRIORIDAD_DEFS[p].label} <span aria-hidden>✕</span>
            </Link>
          ))}
          {filtro.categoriaIds.map((id) => (
            <Link
              key={`a-${id}`}
              href={url({
                ...filtro,
                categoriaIds: alternar(filtro.categoriaIds, id),
              })}
              className={`${CHIP} bg-paper-2`}
              aria-label={`Quitar el filtro de categoría ${nombreDe.get(id) ?? id}`}
            >
              Categoría: {nombreDe.get(id) ?? id} <span aria-hidden>✕</span>
            </Link>
          ))}
          {activos > 1 ? (
            <Link href="/tareas" className={`${CHIP} bg-paper-2`}>
              Quitar todos
            </Link>
          ) : null}
        </div>
      ) : null}

      {/*
        Dicho en voz alta, porque no se puede deducir mirando: la prioridad
        etiqueta y filtra, y no cambia el orden de la lista.
      */}
      <p style={{ fontSize: 12, margin: "2px 0 0" }}>
        Los filtros suman dentro de un grupo y se cruzan entre grupos. La
        prioridad <b>etiqueta y filtra</b>; no reordena la lista.
      </p>
    </div>
  );
}
