import { db } from "@/modules/core/db";
import {
  getTasksGrouped,
  getTaskMetrics,
  listCategorias,
  getConteosDeFacetas,
} from "@/modules/habitos";
import { parseTaskFilter } from "@/modules/habitos/lib/tasks";
import { Card } from "@/modules/core/ui/Card";
import { TasksBoard } from "@/modules/habitos/components/tasks/TasksBoard";
import { TasksHeader } from "@/modules/habitos/components/tasks/TasksHeader";
import { FilterBar } from "@/modules/habitos/components/tasks/FilterBar";
import { FlowPanel } from "@/modules/habitos/components/tasks/FlowPanel";

export const dynamic = "force-dynamic";

/*
  `searchParams` es una PROMESA en esta versión de Next y hay que esperarla.
  Verificado en node_modules/next/dist/docs/01-app/01-getting-started/
  03-layouts-and-pages.md, sección «Rendering with search params».
*/
export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const filtro = parseTaskFilter(await searchParams);
  const [grouped, conteos, metrics, categorias] = await Promise.all([
    getTasksGrouped(db, filtro),
    getConteosDeFacetas(db, filtro),
    getTaskMetrics(db),
    listCategorias(db),
  ]);

  // Sobre lo ya filtrado, a propósito: es lo que hace que un filtro sin
  // resultados enseñe un mensaje en vez de tres columnas vacías sin explicar.
  const total =
    grouped.TODO.length + grouped.IN_PROGRESS.length + grouped.DONE.length;
  const filtrando =
    filtro.categoriaIds.length > 0 || filtro.prioridades.length > 0;

  return (
    // Se cae `.m-root`: la pantalla pone ya su propio papel.
    <main
      style={{
        minHeight: "100%",
        padding: "24px 16px 56px",
        background: "var(--color-paper)",
        color: "var(--color-tinta)",
        fontFamily: "var(--font-cuerpo)",
      }}
    >
      <div
        style={{
          maxWidth: 1040,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <TasksHeader total={total} categorias={categorias} />
        <FilterBar categorias={categorias} filtro={filtro} conteos={conteos} />

        {total === 0 ? (
          <Card style={{ textAlign: "center", padding: 40 }}>
            <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
              {filtrando
                ? "Ninguna tarea pasa este filtro."
                : "Aún no tienes tareas."}
            </p>
            <p style={{ fontSize: 13 }}>
              {filtrando
                ? "Prueba a quitar el filtro de arriba."
                : "Crea la primera y esta pantalla empezará a medir tu ritmo."}
            </p>
          </Card>
        ) : (
          <>
            <TasksBoard grouped={grouped} categorias={categorias} />
            <FlowPanel metrics={metrics} />
          </>
        )}
      </div>
    </main>
  );
}
