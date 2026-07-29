"use client";

import { useState, useTransition } from "react";
import { createProjectTask } from "@/modules/habitos/actions";
import type { NodoArbol, TaskTreeNode } from "@/modules/habitos/lib/tasks";
import { Button } from "@/modules/core/ui/Button";
import { TaskTreeItem, CAMPO_LINEA } from "./TaskTreeItem";

/**
 * El árbol de subtareas. Lo comparten `/proyectos` y `/tareas`, igual que
 * comparten `buildTaskTree` en la capa de datos y por la misma razón: desde la
 * unificación de tablas es el mismo árbol.
 *
 * `projectId` es OPCIONAL y solo sirve para ofrecer «añadir» en la raíz, que es
 * lo que hace `/proyectos`. En `/tareas` la raíz se crea con el botón «Nueva
 * tarea» de la cabecera, así que no se pasa y el formulario no aparece.
 *
 * Es un `string` y no una función a propósito: este componente es de cliente y
 * lo monta una página de servidor, que no puede pasarle una función anónima.
 */
export function TaskTree({
  projectId,
  roots,
}: {
  projectId?: string;
  roots: TaskTreeNode<NodoArbol>[];
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    startTransition(async () => {
      if (!projectId) return;
      await createProjectTask(projectId, null, t);
      setTitle("");
      setAdding(false);
    });
  }

  return (
    <div>
      {roots.length === 0 && !adding ? (
        <p style={{ fontSize: 13, padding: "12px 0" }}>
          Sin subtareas todavía.
          {projectId ? " Añade la primera y empieza a anidar." : ""}
        </p>
      ) : (
        roots.map((node) => (
          <TaskTreeItem key={node.id} node={node} depth={0} />
        ))
      )}

      {!projectId ? null : adding ? (
        <form onSubmit={submit} style={{ display: "flex", gap: 8, paddingTop: 8 }}>
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
          <Button type="submit" variant="primary" size="sm" disabled={pending || !title.trim()}>
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
