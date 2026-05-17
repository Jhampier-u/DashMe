"use client";

import { useState, useTransition } from "react";
import { createTask } from "@/app/actions";
import { PixelButton } from "./PixelButton";

export function NewTaskForm() {
  const [open, setOpen] = useState(false);
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
      setTitle("");
      setDescription("");
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <PixelButton variant="accent" onClick={() => setOpen(true)}>
        + Nueva tarea
      </PixelButton>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 w-full max-w-md p-4 pixel-edge-tight"
      style={{ background: "var(--color-surface)" }}
    >
      <label className="font-display text-[0.6rem] tracking-wider text-[var(--color-ink-soft)]">
        Título
      </label>
      <input
        autoFocus
        className="pixel-input"
        placeholder="ej. Llamar al banco"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={120}
      />

      <label className="font-display text-[0.6rem] tracking-wider text-[var(--color-ink-soft)] mt-2">
        Descripción (opcional)
      </label>
      <textarea
        className="pixel-input"
        placeholder="Detalles…"
        rows={2}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={400}
      />

      <div className="flex gap-2 mt-3">
        <PixelButton type="submit" variant="primary" disabled={pending || !title.trim()}>
          {pending ? "Guardando..." : "Crear"}
        </PixelButton>
        <PixelButton
          type="button"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setTitle("");
            setDescription("");
          }}
          disabled={pending}
        >
          Cancelar
        </PixelButton>
      </div>
    </form>
  );
}
