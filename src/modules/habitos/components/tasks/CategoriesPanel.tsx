"use client";

import { useState, useTransition } from "react";
import { COLORES, varColor } from "@/modules/core/ui/paleta";
import {
  borrarCategoria,
  cambiarColorCategoria,
  crearCategoria,
  renombrarCategoria,
} from "@/modules/habitos/actions";
import type { Categoria } from "@/modules/habitos/lib/categorias";
import { useConfirm } from "@/modules/habitos/components/ConfirmDialog";

const MUESTRA =
  "w-5 h-5 rounded-control border-3 border-line cursor-pointer shrink-0 " +
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-line";

const CHIP =
  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-control " +
  "border-3 border-line text-tinta font-cuerpo text-xs cursor-pointer bg-paper";

const CAMPO =
  "bg-paper-2 text-tinta font-cuerpo border-3 border-line rounded-control " +
  "placeholder:text-tinta-2 outline-none " +
  "focus:outline-3 focus:outline-offset-2 focus:outline-line";

/**
 * Crear, renombrar, recolorear y borrar categorías.
 *
 * Va aquí y no en una pantalla aparte porque el sitio donde se echan de menos
 * es justo la barra de filtros: si no hay ninguna, los chips de categoría están
 * vacíos y no hay desde dónde crearlas.
 */
export function CategoriesPanel({ categorias }: { categorias: Categoria[] }) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [color, setColor] = useState<string>("pink");
  const [aviso, setAviso] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirm();

  function crear() {
    if (!nombre.trim()) return;
    startTransition(async () => {
      const r = await crearCategoria(nombre, color);
      if (r.ok) {
        setNombre("");
        setAviso(null);
      } else {
        // El motivo se traduce aquí y no en `lib/`: la capa de datos devuelve
        // una causa, no una frase para una persona.
        setAviso(r.motivo === "repetida" ? "Esa ya existe" : "Ponle un nombre");
      }
    });
  }

  async function borrar(c: Categoria) {
    const ok = await confirm({
      title: "Borrar categoría",
      message:
        c.taskCount > 0
          ? `"${c.name}" está en ${c.taskCount} tarea(s). Se quedarán sin categoría, no se borran.`
          : `Se borrará "${c.name}".`,
    });
    if (!ok) return;
    startTransition(() => borrarCategoria(c.id));
  }

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className={CHIP}>
        ✎ Categorías
      </button>
    );
  }

  return (
    <div
      style={{
        background: "var(--color-paper)",
        border: "3px solid var(--color-line)",
        borderRadius: "var(--radius-card)",
        boxShadow: "var(--shadow-hard)",
        padding: 14,
        color: "var(--color-tinta)",
        fontFamily: "var(--font-cuerpo)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        width: "100%",
        opacity: pending ? 0.6 : 1,
      }}
    >
      <div
        style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}
      >
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") crear();
            if (e.key === "Escape") setAbierto(false);
          }}
          placeholder="Nueva categoría"
          maxLength={40}
          className={`${CAMPO} text-[13.5px] px-2.5 py-2 w-48`}
        />
        {COLORES.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setColor(k)}
            aria-label={k}
            aria-pressed={color === k}
            className={MUESTRA}
            style={{
              background: varColor(k),
              boxShadow: color === k ? "var(--shadow-hard)" : "none",
            }}
          />
        ))}
        <button
          type="button"
          onClick={crear}
          disabled={pending || !nombre.trim()}
          className={`${CHIP} disabled:opacity-40`}
        >
          Crear
        </button>
        <button type="button" onClick={() => setAbierto(false)} className={CHIP}>
          Cerrar
        </button>
      </div>

      {aviso ? <div style={{ fontSize: 12 }}>{aviso}</div> : null}

      {categorias.map((c) => (
        <div
          key={c.id}
          style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}
        >
          {/*
            El renombrado se dispara al salir del campo y no con un botón: son
            campos que se editan de uno en uno y volver a pulsar «guardar» por
            cada uno sobra. Si el nombre choca, `refresh()` devuelve el campo a
            su valor real en el siguiente pintado.
          */}
          <input
            defaultValue={c.name}
            maxLength={40}
            onBlur={(e) => {
              const v = e.target.value;
              if (v.trim() && v !== c.name) {
                startTransition(async () => {
                  await renombrarCategoria(c.id, v);
                });
              }
            }}
            aria-label={`Nombre de ${c.name}`}
            className={`${CAMPO} text-[13px] px-2 py-1 w-40`}
            style={{ borderBottom: `3px solid ${varColor(c.color)}` }}
          />
          {COLORES.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => startTransition(() => cambiarColorCategoria(c.id, k))}
              aria-label={`${c.name} en ${k}`}
              aria-pressed={c.color === k}
              className={MUESTRA}
              style={{
                background: varColor(k),
                boxShadow: c.color === k ? "var(--shadow-hard)" : "none",
              }}
            />
          ))}
          <span style={{ fontSize: 11.5 }}>{c.taskCount} tarea(s)</span>
          {/* Peach es el acento destructivo del armazón, el mismo que en la
              fila de hábito y que la variante `danger` de <Button>. */}
          <button
            type="button"
            onClick={() => borrar(c)}
            className={`${CHIP} bg-peach`}
            aria-label={`Borrar ${c.name}`}
          >
            ✕
          </button>
        </div>
      ))}
      {dialog}
    </div>
  );
}
