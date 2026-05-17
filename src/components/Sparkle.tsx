"use client";

import { useState } from "react";

type Particle = {
  id: number;
  dx: number;
  dy: number;
  rot: number;
  emoji: string;
  duration: number;
};

let nextId = 0;

const SPARK_EMOJIS = ["✨", "⭐", "💫", "✦"];
const DROP_EMOJIS = ["💧", "💦", "💧"];

type Mode = "spark" | "drop";

export function useSparkleBurst(mode: Mode = "spark") {
  const [particles, setParticles] = useState<Particle[]>([]);

  function burst() {
    const isDrop = mode === "drop";
    const set = isDrop ? DROP_EMOJIS : SPARK_EMOJIS;
    const newParts: Particle[] = Array.from({ length: 6 }, () => ({
      id: nextId++,
      dx: (Math.random() - 0.5) * (isDrop ? 50 : 80),
      dy: isDrop ? 30 + Math.random() * 60 : -20 - Math.random() * 60,
      rot: (Math.random() - 0.5) * 60,
      emoji: set[Math.floor(Math.random() * set.length)],
      duration: 700 + Math.random() * 200,
    }));
    setParticles((prev) => [...prev, ...newParts]);
    const ids = new Set(newParts.map((p) => p.id));
    window.setTimeout(() => {
      setParticles((prev) => prev.filter((p) => !ids.has(p.id)));
    }, 900);
  }

  return { particles, burst };
}

export function SparkleLayer({ particles }: { particles: Particle[] }) {
  return (
    <span className="pointer-events-none absolute inset-0 overflow-visible">
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute left-1/2 top-1/2 text-lg select-none"
          style={
            {
              animation: `sparkle-rise ${p.duration}ms steps(8) forwards`,
              ["--dx" as string]: `${p.dx}px`,
              ["--dy" as string]: `${p.dy}px`,
              ["--rot" as string]: `${p.rot}deg`,
            } as React.CSSProperties
          }
        >
          {p.emoji}
        </span>
      ))}
      <style>{`
        @keyframes sparkle-rise {
          0% { transform: translate(-50%, -50%) scale(0.4); opacity: 0; }
          20% { transform: translate(-50%, -50%) scale(1.1); opacity: 1; }
          100% {
            transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(0.6) rotate(var(--rot));
            opacity: 0;
          }
        }
      `}</style>
    </span>
  );
}
