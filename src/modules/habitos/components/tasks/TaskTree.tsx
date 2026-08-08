"use client";

import { useState, useTransition } from "react";
import { createProjectTask, crearSubtarea } from "@/modules/habitos/actions";
import type { NodoArbol, TaskTreeNode } from "@/modules/habitos/lib/tasks";
import { Button } from "@/modules/core/ui/Button";
import { TaskTreeItem, CAMPO_LINEA } from "./TaskTreeItem";

/**
 * El árbol de subtareas. Lo comparten `/proyectos` y `/tareas`, igual que
 * comparten `buildTaskTree` en la capa de datos y por la misma razón: desde la
 * unificación de tablas es el mismo árbol.
 *
 * Los dos `...Id` dicen DÓNDE cuelga lo que se cree desde el formulario de la
 * raíz, y se usa uno u otro según quién monte el árbol:
 *
 *   projectId — `/proyectos`: la raíz del árbol es la raíz del proyecto.
 *   parentId  — `/tareas`: la raíz del árbol cuelga de la tarjeta.
 *
 * Sin ninguno de los dos el formulario no aparece y el árbol es de solo
 * lectura. `parentId` hace falta porque si no, desde `/tareas` sería imposible
 * crear la PRIMERA subtarea de una tarea: la tarjeta solo abre el árbol cuando
 * ya hay hijos.
 *
 * Son `string` y no funciones a propósito: este componente es de cliente y lo
 * monta una página de servidor, que no puede pasarle una función anónima.
 */
export function TaskTree({
  projectId,
  parentId,
  roots,
}: {
  projectId?: string;
  parentId?: string;
  roots: TaskTreeNode<NodoArbol>[];
}) {
  const puedeCrear = Boolean(projectId ?? parentId);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    startTransition(async () => {
      if (projectId) await createProjectTask(projectId, null, t);
      else if (parentId) await crearSubtarea(parentId, t);
      else return;
      setTitle("");
      setAdding(false);
    });
  }

  return (
    <div>
      {roots.length === 0 && !adding ? (
        <p style={{ fontSize: 13, padding: "12px 0" }}>
          Sin subtareas todavía.
          {puedeCrear ? " Añade la primera y empieza a anidar." : ""}
        </p>
      ) : (
        roots.map((node) => (
          <TaskTreeItem key={node.id} node={node} depth={0} />
        ))
      )}

      {!puedeCrear ? null : adding ? (
        <form
          onSubmit={submit}
          style={{ display: "flex", gap: 8, paddingTop: 8 }}
        >
          <input
            autoFocus
            value={title}
            maxLength={200}
            placeholder="Nueva subtarea…"
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setAdding(false);
                setTitle("");
              }
            }}
            className={CAMPO_LINEA}
          />
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={pending || !title.trim()}
          >
            Añadir
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setAdding(false);
              setTitle("");
            }}
          >
            Cancelar
          </Button>
        </form>
      ) : (
        <div style={{ paddingTop: 12 }}>
          <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
            Añadir subtarea
          </Button>
        </div>
      )}
    </div>
  );
}
