"use client";

import { useState, useTransition } from "react";
import { createTask } from "@/modules/habitos/actions";
import { Button } from "@/modules/core/ui/Button";
import { Field, TextArea } from "@/modules/core/ui/Field";
import { varColor } from "@/modules/core/ui/paleta";
import type { Categoria } from "@/modules/habitos/lib/categorias";
import {
  PRIORIDADES,
  PRIORIDAD_DEFS,
  prioridadColorVar,
  type Prioridad,
} from "@/modules/habitos/lib/prioridad";

/** La cápsula de los dos selectores: misma forma, distinto relleno. */
const OPCION =
  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-control " +
  "border-3 border-line text-tinta font-cuerpo text-xs cursor-pointer " +
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-line";

const ETIQUETA = "block text-xs font-semibold text-tinta font-cuerpo mb-1.5";

/** La superficie de `Card`, a mano: esto es un `<form>` y `Card` es un `<div>`. */
const SUPERFICIE = {
  background: "var(--color-paper)",
  border: "3px solid var(--color-line)",
  borderRadius: "var(--radius-card)",
  boxShadow: "var(--shadow-hard)",
  padding: 18,
  color: "var(--color-tinta)",
  fontFamily: "var(--font-cuerpo)",
} as const;

/**
 * Solo el formulario. Quién decide si está abierto es TasksHeader, porque el
 * botón vive en la cabecera y el formulario debajo, a todo el ancho: metido en
 * el hueco de la acción se quedaba en 215 px y no cabían los campos.
 */
export function NewTaskForm({
  onDone,
  categorias,
}: {
  onDone: () => void;
  categorias: Categoria[];
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [prioridad, setPrioridad] = useState<Prioridad | null>(null);
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!title.trim()) return;
    const fd = new FormData();
    fd.set("title", title);
    fd.set("description", description);
    if (prioridad) fd.set("priority", prioridad);
    if (categoriaId) fd.set("categoryId", categoriaId);
    startTransition(async () => {
      await createTask(fd);
      onDone();
    });
  }

  return (
    <form
      onSubmit={submit}
      style={{ ...SUPERFICIE, display: "flex", flexDirection: "column", gap: 16 }}
    >
      <Field
        label="Título"
        value={title}
        onChange={setTitle}
        placeholder="ej. Llamar al banco"
        maxLength={120}
        autoFocus
      />
      <TextArea
        label="Descripción (opcional)"
        value={description}
        onChange={setDescription}
        placeholder="Detalles…"
        maxLength={400}
      />
      <div>
        <span className={ETIQUETA}>Prioridad (opcional)</span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {PRIORIDADES.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPrioridad(prioridad === p ? null : p)}
              aria-pressed={prioridad === p}
              className={OPCION}
              style={{
                background:
                  prioridad === p ? prioridadColorVar(p) : "var(--color-paper)",
                boxShadow: prioridad === p ? "var(--shadow-hard)" : "none",
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
            </button>
          ))}
        </div>
      </div>

      {categorias.length > 0 ? (
        <div>
          <span className={ETIQUETA}>Categoría (opcional)</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {categorias.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoriaId(categoriaId === c.id ? null : c.id)}
                aria-pressed={categoriaId === c.id}
                className={OPCION}
                style={{
                  background:
                    categoriaId === c.id
                      ? varColor(c.color)
                      : "var(--color-paper)",
                  borderBottom: `3px solid ${varColor(c.color)}`,
                  boxShadow: categoriaId === c.id ? "var(--shadow-hard)" : "none",
                }}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <Button variant="secondary" onClick={onDone} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={pending || !title.trim()}>
          {pending ? "Guardando…" : "Crear"}
        </Button>
      </div>
    </form>
  );
}
