"use client";

import { useState, useTransition } from "react";
import { createProject } from "@/modules/habitos/actions";
import { Button } from "@/modules/core/ui/Button";
import { Field, TextArea } from "@/modules/core/ui/Field";

const ICONS = ["📁", "🎯", "🚀", "🎨", "🎮", "📚", "💼", "🏗️", "🌟", "🧪", "🎵", "🌱"];

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
      className="m-card"
      style={{ display: "flex", flexDirection: "column", gap: 14 }}
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
        <span style={{ display: "block", fontSize: 12, color: "var(--m-ink-2)", marginBottom: 6 }}>
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
              style={{
                width: 34,
                height: 34,
                fontSize: 16,
                borderRadius: 7,
                cursor: "pointer",
                background: icon === choice ? "rgba(57, 135, 229, 0.16)" : "var(--m-elevated)",
                border: `1px solid ${icon === choice ? "var(--m-series)" : "var(--m-line)"}`,
              }}
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
