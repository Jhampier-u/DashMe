import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/modules/core/db";
import { getTask, listAttachments, listCategorias } from "@/modules/habitos";
import { TaskDetail } from "@/modules/habitos/components/tasks/TaskDetail";

export const dynamic = "force-dynamic";

/*
  `params` es una PROMESA en esta versión de Next, igual que `searchParams`.
*/
export default async function TaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [tarea, categorias, adjuntos] = await Promise.all([
    getTask(db, id),
    listCategorias(db),
    listAttachments(db, id),
  ]);
  if (!tarea) notFound();

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
          maxWidth: 760,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <Link
          href="/tareas"
          style={{ fontSize: 13, color: "var(--color-tinta)" }}
        >
          ← Todas las tareas
        </Link>
        <TaskDetail tarea={tarea} categorias={categorias} adjuntos={adjuntos} />
      </div>
    </main>
  );
}
