"use client";

import { useState, useTransition } from "react";
import { createTask } from "@/app/actions";
import { Button } from "@/components/ui/Button";
import { Field, TextArea } from "@/components/ui/Field";

export function NewTaskForm() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pending, startTransition] = useTransition();

  function close() {
    setOpen(false);
    setTitle("");
    setDescription("");
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!title.trim()) return;
    const fd = new FormData();
    fd.set("title", title);
    fd.set("description", description);
    startTransition(async () => {
      await createTask(fd);
      close();
    });
  }

  if (!open) {
    return (
      <Button variant="primary" onClick={() => setOpen(true)}>
        Nueva tarea
      </Button>
    );
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
        <Button variant="secondary" onClick={close} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={pending || !title.trim()}>
          {pending ? "Guardando…" : "Crear"}
        </Button>
      </div>
    </form>
  );
}
