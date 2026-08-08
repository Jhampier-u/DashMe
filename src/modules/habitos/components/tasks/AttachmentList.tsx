"use client";

import { useRef, useState, useTransition } from "react";
import {
  anadirArchivo,
  anadirEnlace,
  borrarAdjunto,
} from "@/modules/habitos/actions";
import type { Adjunto } from "@/modules/habitos/lib/adjuntos";
import { Button } from "@/modules/core/ui/Button";
import { useConfirm } from "@/modules/habitos/components/ConfirmDialog";

/**
 * El motivo se traduce aquí y no en `lib/`: la capa de datos devuelve una causa,
 * no una frase para una persona.
 */
const MOTIVOS: Record<string, string> = {
  grande: "Ese archivo pasa de 50 MB.",
  vacio: "Ese archivo está vacío.",
  "sin-nombre": "Ese archivo no tiene nombre.",
  "sin-archivo": "No se recibió ningún archivo.",
  esquema: "Solo enlaces http o https.",
  "no-es-url": "Eso no parece una dirección.",
  ruta: "No se pudo guardar el archivo.",
};

const CAMPO =
  "bg-paper-2 text-tinta font-cuerpo text-[13px] border-3 border-line " +
  "rounded-control px-2 py-1.5 placeholder:text-tinta-2 outline-none " +
  "focus:outline-3 focus:outline-offset-2 focus:outline-line";

function tamano(bytes: number | null): string {
  if (bytes === null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function AttachmentList({
  taskId,
  adjuntos,
}: {
  taskId: string;
  adjuntos: Adjunto[];
}) {
  const [aviso, setAviso] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [url, setUrl] = useState("");
  const [pending, startTransition] = useTransition();
  const archivo = useRef<HTMLInputElement>(null);
  const { confirm, dialog } = useConfirm();

  function subir(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const fd = new FormData();
    fd.set("file", f);
    startTransition(async () => {
      const r = await anadirArchivo(taskId, fd);
      setAviso(r.ok ? null : (MOTIVOS[r.motivo] ?? "No se pudo subir."));
      // Se limpia para poder volver a elegir el MISMO archivo: sin esto, el
      // `change` no vuelve a dispararse y parece que la subida se ignora.
      if (archivo.current) archivo.current.value = "";
    });
  }

  function enlazar() {
    if (!url.trim()) return;
    startTransition(async () => {
      const r = await anadirEnlace(taskId, nombre, url);
      if (r.ok) {
        setNombre("");
        setUrl("");
        setAviso(null);
      } else {
        setAviso(MOTIVOS[r.motivo] ?? "No se pudo añadir.");
      }
    });
  }

  async function borrar(a: Adjunto) {
    const ok = await confirm({
      title: "Borrar adjunto",
      message: `Se borrará "${a.name}".`,
    });
    if (!ok) return;
    startTransition(() => borrarAdjunto(a.id));
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        opacity: pending ? 0.6 : 1,
      }}
    >
      {adjuntos.length === 0 ? (
        <p style={{ fontSize: 13 }}>Sin adjuntos.</p>
      ) : (
        <ul
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            listStyle: "none",
            padding: 0,
            margin: 0,
          }}
        >
          {adjuntos.map((a) => (
            <li
              key={a.id}
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <span aria-hidden style={{ fontSize: 14 }}>
                {a.kind === "file" ? "📎" : "🔗"}
              </span>
              <a
                href={
                  a.kind === "file" ? `/api/adjunto/${a.id}` : (a.url ?? "#")
                }
                /* Los enlaces del usuario salen fuera: `noopener` para que la
                   página abierta no pueda tocar esta, y `noreferrer` para no
                   contarle de dónde viene. */
                {...(a.kind === "link"
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
                style={{
                  fontSize: 13,
                  color: "var(--color-tinta)",
                  overflowWrap: "anywhere",
                }}
              >
                {a.name}
              </a>
              {a.kind === "file" ? (
                <span style={{ fontSize: 11.5 }}>{tamano(a.size)}</span>
              ) : null}
              <span style={{ flex: 1 }} />
              {/* Peach es el acento destructivo del armazón. */}
              <button
                type="button"
                onClick={() => borrar(a)}
                aria-label={`Borrar ${a.name}`}
                className="px-2 py-0.5 rounded-control border-3 border-line bg-peach text-tinta font-cuerpo text-xs cursor-pointer shrink-0"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {aviso ? <p style={{ fontSize: 12.5 }}>{aviso}</p> : null}

      <div>
        <input
          ref={archivo}
          type="file"
          onChange={subir}
          disabled={pending}
          aria-label="Subir un archivo"
          className="text-[12.5px] font-cuerpo text-tinta"
        />
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "center",
        }}
      >
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") enlazar();
          }}
          placeholder="https://…"
          aria-label="Dirección del enlace"
          className={`${CAMPO} w-56`}
        />
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre (opcional)"
          maxLength={120}
          aria-label="Nombre del enlace"
          className={`${CAMPO} w-44`}
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={enlazar}
          disabled={pending || !url.trim()}
        >
          Añadir enlace
        </Button>
      </div>
      {dialog}
    </div>
  );
}
