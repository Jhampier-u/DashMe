"use client";

import { useEffect, useState } from "react";
import { MAX_SHIELDS, type LevelInfo } from "@/lib/level";

type Props = {
  initial: LevelInfo & { shields: number };
  completedToday: number;
  totalHabits: number;
};

type XpDetail = {
  xp: number;
  newLevel: number;
  progress: number;
  shields?: number;
};

function avatarFor(percent: number) {
  if (percent === 0) return "😴";
  if (percent >= 1) return "🦸";
  if (percent >= 0.5) return "🧙‍♂️";
  return "🧙";
}

function moodTextFor(percent: number, total: number) {
  if (total === 0) return "Crea tu primer hábito y empezamos";
  if (percent === 0) return "Aún no has hecho nada hoy. ¡A despertar!";
  if (percent >= 1) return "¡Día perfecto! 🌟";
  if (percent >= 0.5) return "Vas muy bien, sigue así";
  return "Buen comienzo, no pares";
}

export function PlayerStatus({ initial, completedToday, totalHabits }: Props) {
  const [info, setInfo] = useState<LevelInfo & { shields: number }>(initial);
  const [pulse, setPulse] = useState(false);

  useEffect(() => setInfo(initial), [initial]);

  useEffect(() => {
    function handler(e: Event) {
      const d = (e as CustomEvent<XpDetail>).detail;
      setInfo((prev) => ({
        ...prev,
        xp: d.xp,
        level: d.newLevel,
        progress: d.progress,
        shields: d.shields ?? prev.shields,
      }));
      setPulse(true);
      window.setTimeout(() => setPulse(false), 400);
    }
    window.addEventListener("untap:xp", handler);
    return () => window.removeEventListener("untap:xp", handler);
  }, []);

  const percent = totalHabits === 0 ? 0 : completedToday / totalHabits;
  const avatar = avatarFor(percent);
  const mood = moodTextFor(percent, totalHabits);

  return (
    <div className="flex items-center gap-6">
      <div
        className="w-20 h-20 flex items-center justify-center text-5xl pixel-edge-tight untap-bobble"
        style={{
          background:
            percent >= 1
              ? "var(--color-peach)"
              : percent >= 0.5
                ? "var(--color-mint)"
                : "var(--color-lavender)",
          transform: pulse ? "scale(1.08)" : undefined,
          transition: "background 300ms",
        }}
      >
        {avatar}
      </div>
      <div className="flex-1">
        <div className="flex items-baseline justify-between mb-2">
          <span className="font-display text-sm text-[var(--color-ink)]">
            Nv. {info.level}
          </span>
          <span className="text-lg text-[var(--color-ink-soft)]">{info.xp} XP</span>
        </div>
        <div
          className="h-5 pixel-edge-tight overflow-hidden"
          style={{ background: "var(--color-bg-deep)" }}
        >
          <div
            className="h-full"
            style={{
              width: `${Math.round(info.progress * 100)}%`,
              background: "var(--color-peach)",
              transition: "width 300ms steps(8)",
            }}
          />
        </div>
        <div className="text-sm text-[var(--color-ink-dim)] mt-1">
          {info.xpIntoLevel} / {info.xpForNextLevel} para Nv. {info.level + 1}
        </div>

        {/* shields */}
        <div className="flex items-center gap-2 mt-2">
          <span className="font-display text-[0.55rem] text-[var(--color-ink-dim)] tracking-wider">
            ESCUDOS
          </span>
          <div className="flex gap-1">
            {Array.from({ length: MAX_SHIELDS }).map((_, i) => (
              <span
                key={i}
                className="text-base"
                style={{
                  filter: i < info.shields ? "none" : "grayscale(1) opacity(0.3)",
                }}
                title={i < info.shields ? "Escudo disponible" : "Escudo gastado"}
              >
                🛡️
              </span>
            ))}
          </div>
          <span className="text-base text-[var(--color-ink-soft)] italic">{mood}</span>
        </div>
      </div>
    </div>
  );
}
