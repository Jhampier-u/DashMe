"use client";

import { useState, useTransition } from "react";
import { createTask } from "@/modules/habitos/actions";
import { Button } from "@/modules/core/ui/Button";
import { Field, TextArea } from "@/modules/core/ui/Field";

/**
 * Solo el formulario. Quién decide si está abierto es TasksHeader, porque el
 * botón vive en la cabecera y el formulario debajo, a todo el ancho: metido en
 * el hueco de la acción se quedaba en 215 px y no cabían los campos.
 */
export function NewTaskForm({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!title.trim()) return;
    const fd = new FormData();
    fd.set("title", title);
    fd.set("description", description);
    startTransition(async () => {
      await createTask(fd);
      onDone();
    });
  }

  return (
    <form
      onSubmit={submit}
      className="m-card"
      style={{ display: "flex", flexDirection: "column", gap: 14 }}
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
