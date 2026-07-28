"use client";

import { useEffect, useState } from "react";
import { MAX_SHIELDS, type LevelInfo } from "@/modules/habitos/lib/level";
import { on } from "@/modules/habitos/lib/events";
import { Card } from "@/modules/core/ui/Card";
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
          <span style={{ fontSize: 34 }} aria-hidden>
            {avatarFor(ratio, scheduled)}
          </span>
          <ProgressRing value={done} max={scheduled} size={52} stroke={4} />
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
              <span
                className="m-num"
                style={{ fontSize: 30, fontWeight: 650, letterSpacing: "-0.03em", lineHeight: 1 }}
              >
                {done}
              </span>
              <span className="m-num" style={{ fontSize: 16, color: "var(--m-ink-3)" }}>
                /{scheduled}
              </span>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--m-ink-2)", marginTop: 4 }}>
              {moodFor(ratio, scheduled)}
            </div>
          </div>
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", gap: 20 }}>
          <div>
            <div className="m-label">Nivel</div>
            <div className="m-num" style={{ fontSize: 18, fontWeight: 600, marginTop: 4 }}>
              {info.level}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--m-ink-3)", marginTop: 2 }}>
              {info.xpForNextLevel - info.xpIntoLevel} XP para el {info.level + 1}
            </div>
          </div>
          <div>
            <div className="m-label">Escudos</div>
            <div className="m-num" style={{ fontSize: 18, fontWeight: 600, marginTop: 4 }}>
              {info.shields} / {MAX_SHIELDS}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--m-ink-3)", marginTop: 2 }}>
              perdonan un día
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
