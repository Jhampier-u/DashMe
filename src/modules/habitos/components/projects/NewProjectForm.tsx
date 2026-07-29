"use client";

import { useState, useTransition } from "react";
import { createProject } from "@/modules/habitos/actions";
import { Button } from "@/modules/core/ui/Button";
import { Field, TextArea } from "@/modules/core/ui/Field";

const ICONS = ["📁", "🎯", "🚀", "🎨", "🎮", "📚", "💼", "🏗️", "🌟", "🧪", "🎵", "🌱"];

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

export function NewProjectForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("📁");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) return;
    const fd = new FormData();
    fd.set("name", name);
    fd.set("description", description);
    fd.set("icon", icon);
    startTransition(async () => {
      await createProject(fd);
      onDone();
    });
  }

  return (
    <form
      onSubmit={submit}
      style={{ ...SUPERFICIE, display: "flex", flexDirection: "column", gap: 16 }}
    >
      <Field
        label="Nombre"
        value={name}
        onChange={setName}
        placeholder="ej. Reforma del salón"
        maxLength={60}
        autoFocus
      />
      <TextArea
        label="Descripción (opcional)"
        value={description}
        onChange={setDescription}
        placeholder="De qué va…"
        maxLength={300}
      />

      <div>
        <span style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
          Icono
        </span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {ICONS.map((choice) => (
            <button
              key={choice}
              type="button"
              onClick={() => setIcon(choice)}
              aria-pressed={icon === choice}
              aria-label={`Icono ${choice}`}
              // Lo elegido se marca con la variante `aria-pressed:`, que lee el
              // atributo que ya estaba puesto: el estado visual y el accesible
              // no pueden separarse. Es lo mismo que hace NewHabitForm.
              className={
                "w-[36px] h-[36px] inline-flex items-center justify-center " +
                "rounded-control border-3 border-line bg-paper text-tinta text-base " +
                "cursor-pointer shadow-hard font-cuerpo " +
                "transition-[transform,box-shadow] duration-75 ease-out " +
                "active:translate-x-0.5 active:translate-y-0.5 " +
                "active:shadow-[2px_2px_0_var(--color-line)] " +
                "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-line " +
                "aria-pressed:bg-sky"
              }
            >
              {choice}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <Button variant="secondary" onClick={onDone} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={pending || !name.trim()}>
          {pending ? "Guardando…" : "Crear"}
        </Button>
      </div>
    </form>
  );
}
