"use client";

import { useState, useTransition } from "react";
import { createProject } from "@/app/actions";
import { PixelButton } from "./PixelButton";

const ICONS = ["📁", "🎯", "🚀", "🎨", "🎮", "📚", "💼", "🏗️", "🌟", "🧪", "🎵", "🌱"];
const COLORS: { key: string; var: string }[] = [
  { key: "lavender", var: "var(--color-lavender)" },
  { key: "mint", var: "var(--color-mint)" },
  { key: "peach", var: "var(--color-peach)" },
  { key: "sky", var: "var(--color-sky)" },
  { key: "pink", var: "var(--color-pink)" },
];

export function NewProjectForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("📁");
  const [color, setColor] = useState("lavender");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) return;
    const fd = new FormData();
    fd.set("name", name);
    fd.set("description", description);
    fd.set("icon", icon);
    fd.set("color", color);
    startTransition(async () => {
      await createProject(fd);
      setName("");
      setDescription("");
      setIcon("📁");
      setColor("lavender");
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <PixelButton variant="primary" onClick={() => setOpen(true)}>
        + Nuevo proyecto
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
        Nombre del proyecto
      </label>
      <input
        autoFocus
        className="pixel-input"
        placeholder="ej. Aprender japonés"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={80}
      />

      <label className="font-display text-[0.6rem] tracking-wider text-[var(--color-ink-soft)]">
        Descripción (opcional)
      </label>
      <textarea
        className="pixel-input"
        placeholder="¿En qué consiste?"
        rows={2}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={300}
      />

      <label className="font-display text-[0.6rem] tracking-wider text-[var(--color-ink-soft)]">
        Icono
      </label>
      <div className="grid grid-cols-6 gap-2">
        {ICONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => setIcon(emoji)}
            className="pixel-button text-2xl p-2"
            style={{
              background:
                icon === emoji ? "var(--color-lavender)" : "var(--color-bg-deep)",
              boxShadow: "0 0 0 3px var(--color-border)",
            }}
          >
            {emoji}
          </button>
        ))}
      </div>

      <label className="font-display text-[0.6rem] tracking-wider text-[var(--color-ink-soft)]">
        Color
      </label>
      <div className="flex gap-2">
        {COLORS.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setColor(c.key)}
            className="pixel-button w-10 h-10"
            style={{
              background: c.var,
              boxShadow:
                color === c.key
                  ? "0 0 0 3px var(--color-ink), inset 0 0 0 2px var(--color-bg-deep)"
                  : "0 0 0 3px var(--color-border)",
            }}
            aria-label={c.key}
          />
        ))}
      </div>

      <div className="flex gap-2 mt-3">
        <PixelButton type="submit" variant="primary" disabled={pending || !name.trim()}>
          {pending ? "Guardando..." : "Crear proyecto"}
        </PixelButton>
        <PixelButton
          type="button"
          variant="ghost"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Cancelar
        </PixelButton>
      </div>
    </form>
  );
}
