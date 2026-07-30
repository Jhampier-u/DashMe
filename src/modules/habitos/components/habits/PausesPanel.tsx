"use client";

import { useState, useTransition } from "react";
import { crearPausa, quitarPausa } from "@/modules/habitos/actions";
import { Button } from "@/modules/core/ui/Button";
import type { Pausa } from "@/modules/habitos/lib/pausas";

const CAMPO =
  "bg-paper-2 text-tinta font-cuerpo text-[13px] border-3 border-line " +
  "rounded-control px-2 py-1.5 outline-none " +
  "focus:outline-3 focus:outline-offset-2 focus:outline-line";

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Las pausas de un hábito: los días que no cuentan para nada.
 *
 * Los dos extremos entran en el rango, y el rótulo lo dice: «del … al …,
 * incluidos». Con una flecha sola, la mitad de la gente supondría que el último
 * día queda fuera.
 */
export function PausesPanel({
  habitId,
  pausas,
}: {
  habitId: string;
  pausas: Pausa[];
}) {
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [motivo, setMotivo] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function crear() {
    if (!desde || !hasta) return;
    startTransition(async () => {
      const r = await crearPausa(habitId, desde, hasta, motivo);
      if (!r.ok) {
        setAviso("Esas fechas no valen.");
        return;
      }
      setDesde("");
      setHasta("");
      setMotivo("");
      /*
        Se avisa SIEMPRE al crear, y no es un adorno: una pausa que cubra días
        pasados vuelve a unir la racha, así que el número puede subir de golpe.
        Verlo sin explicación parece un fallo.
      */
      setAviso("Guardada. Si cubre días pasados, tu racha se ha recalculado.");
    });
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        opacity: pending ? 0.6 : 1,
      }}
    >
      {pausas.length === 0 ? (
        <p style={{ fontSize: 13 }}>
          Sin pausas. Los días de una pausa no rompen la racha ni bajan tu
          porcentaje.
        </p>
      ) : (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {pausas.map((p) => (
            <li
              key={p.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                flexWrap: "wrap",
              }}
            >
              <span>
                del {iso(p.desde)} al {iso(p.hasta)}, incluidos
              </span>
              {p.reason ? (
                <span style={{ fontSize: 11.5 }}>· {p.reason}</span>
              ) : null}
              <span style={{ flex: 1 }} />
              {/* Peach es el acento destructivo del armazón. */}
              <button
                type="button"
                onClick={() => startTransition(() => quitarPausa(p.id))}
                aria-label={`Quitar la pausa del ${iso(p.desde)}`}
                className="px-2 py-0.5 rounded-control border-3 border-line bg-peach text-tinta font-cuerpo text-xs cursor-pointer shrink-0"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {aviso ? <p style={{ fontSize: 12.5 }}>{aviso}</p> : null}

      <div
        style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}
      >
        <input
          type="date"
          value={desde}
          onChange={(e) => setDesde(e.target.value)}
          aria-label="Primer día de la pausa"
          className={CAMPO}
        />
        <input
          type="date"
          value={hasta}
          onChange={(e) => setHasta(e.target.value)}
          aria-label="Último día de la pausa"
          className={CAMPO}
        />
        <input
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Motivo (opcional)"
          maxLength={120}
          aria-label="Motivo de la pausa"
          className={`${CAMPO} w-40`}
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={crear}
          disabled={pending || !desde || !hasta}
        >
          Añadir pausa
        </Button>
      </div>
    </div>
  );
}
