"use client";

import { useEffect, useState } from "react";
import { MAX_SHIELDS, type LevelInfo } from "@/modules/habitos/lib/level";
import { on } from "@/modules/habitos/lib/events";
import { Card } from "@/modules/core/ui/Card";
import { Stat } from "@/modules/core/ui/Stat";
import { ProgressRing } from "@/modules/habitos/components/charts/ProgressRing";

type Snapshot = LevelInfo & { shields: number };

type Props = {
  initial: Snapshot;
  done: number;
  scheduled: number;
};

/** El avatar sigue existiendo: la estructura se moderniza, el humor se queda. */
function avatarFor(ratio: number, scheduled: number): string {
  if (scheduled === 0) return "🌙";
  if (ratio >= 1) return "🦸";
  if (ratio >= 0.5) return "🙂";
  if (ratio > 0) return "🙃";
  return "😴";
}

function moodFor(ratio: number, scheduled: number): string {
  if (scheduled === 0) return "Hoy no toca ninguno. Descansa.";
  if (ratio >= 1) return "Día completo.";
  if (ratio >= 0.5) return "Vas por buen camino.";
  if (ratio > 0) return "Has empezado, sigue.";
  return "Aún no has marcado nada hoy.";
}

export function DayStatus({ initial, done, scheduled }: Props) {
  const [live, setLive] = useState<Snapshot | null>(null);
  const [lastFromServer, setLastFromServer] = useState(initial);

  // El servidor manda: en cuanto llega un dato nuevo, lo local se descarta.
  if (lastFromServer !== initial) {
    setLastFromServer(initial);
    setLive(null);
  }
  const info = live ?? initial;

  useEffect(() => on("untap:xp", ({ player }) => setLive(player)), []);

  const ratio = scheduled === 0 ? 0 : done / scheduled;

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 36 }} aria-hidden>
            {avatarFor(ratio, scheduled)}
          </span>
          {/*
            El arco va en tinta sobre una pista de paper-2. La convención de
            pista clara y relleno oscuro es la que se lee sin pensar, y el trazo
            de tinta es además el mismo lenguaje que el borde de todo lo demás.
            Ningún pastel: el anillo es dibujo, no decoración de color.
          */}
          <ProgressRing
            value={done}
            max={scheduled}
            size={52}
            stroke={4}
            track="var(--color-paper-2)"
            fill="var(--color-tinta)"
          />
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
              {/* VT323, la fuente de los números. 38 y 22, los dos por encima
                  del mínimo de 16px. */}
              <span
                style={{
                  fontFamily: "var(--font-vt)",
                  fontSize: 38,
                  lineHeight: 1,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {done}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-vt)",
                  fontSize: 22,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                /{scheduled}
              </span>
            </div>
            <div style={{ fontSize: 12.5, marginTop: 4 }}>{moodFor(ratio, scheduled)}</div>
          </div>
        </div>

        <div style={{ flex: 1 }} />

        {/*
          Nivel y escudos dejan de estar cosidos a mano: son exactamente un
          rótulo, un número y un apunte, que es la API de `Stat`. Se ganan de
          paso el reparto de fuentes del sistema sin repetirlo aquí.
        */}
        <div style={{ display: "flex", gap: 22 }}>
          <Stat
            size="sm"
            label="Nivel"
            value={String(info.level)}
            meta={`${info.xpForNextLevel - info.xpIntoLevel} XP para el ${info.level + 1}`}
          />
          <Stat
            size="sm"
            label="Escudos"
            value={`${info.shields} / ${MAX_SHIELDS}`}
            meta="perdonan un día"
          />
        </div>
      </div>
    </Card>
  );
}
