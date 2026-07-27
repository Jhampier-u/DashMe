"use client";

import { useTransition } from "react";
import type { HabitWithStatus } from "@/lib/habits";
import { useLocalHour } from "@/lib/useLocalHour";
import { plantEmoji, stageFor, stageLabel } from "@/lib/garden";
import { toggleToday } from "@/app/actions";
import { emitToggleResult } from "@/lib/events";
import { useSparkleBurst, SparkleLayer } from "./Sparkle";

type Props = { habits: HabitWithStatus[] };

type SkyPhase = "dawn" | "morning" | "midday" | "afternoon" | "dusk" | "night";

function phaseFor(hour: number): SkyPhase {
  if (hour < 6) return "night";
  if (hour < 9) return "dawn";
  if (hour < 12) return "morning";
  if (hour < 15) return "midday";
  if (hour < 18) return "afternoon";
  if (hour < 21) return "dusk";
  return "night";
}

const SKY_GRADIENTS: Record<SkyPhase, string> = {
  dawn:
    "linear-gradient(180deg, #2a1f4a 0%, #6e4a7a 25%, #d8a070 55%, #f5c89e 80%, #3d5a25 80%, #1f3318 100%)",
  morning:
    "linear-gradient(180deg, #7898c0 0%, #a8c8e8 35%, #f0e6d2 60%, #3d5a25 60%, #1f3318 100%)",
  midday:
    "linear-gradient(180deg, #5a8ec8 0%, #8ab8e0 30%, #c8e0f0 55%, #5a8a3a 55%, #2d4a25 100%)",
  afternoon:
    "linear-gradient(180deg, #7898c0 0%, #a8b8d8 30%, #f5c89e 55%, #4a6a25 55%, #2d4a25 100%)",
  dusk:
    "linear-gradient(180deg, #2a1f4a 0%, #9078b0 25%, #f0a8c4 45%, #d4a070 65%, #3d4a25 70%, #1a2510 100%)",
  night:
    "linear-gradient(180deg, #0f0d1f 0%, #1d1b2e 35%, #2a1f4a 60%, #2d3a18 65%, #1a2510 100%)",
};

// El amanecer y el atardecer también cuentan como "oscuros" para las estrellas,
// así que el icono no puede deducirse de isDark — antes el 🌅 nunca salía.
function skyIcon(phase: SkyPhase): string {
  if (phase === "dawn" || phase === "dusk") return "🌅";
  if (phase === "night") return "🌙";
  return "☀️";
}

const SKY_LABEL: Record<SkyPhase, string> = {
  dawn: "AMANECER",
  morning: "MAÑANA",
  midday: "MEDIODÍA",
  afternoon: "TARDE",
  dusk: "ATARDECER",
  night: "NOCHE",
};

function seedRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

export function GardenScene({ habits }: Props) {
  const hour = useLocalHour();
  const phase: SkyPhase = hour === null ? "night" : phaseFor(hour);

  const isDark = phase === "night" || phase === "dusk" || phase === "dawn";

  const rand = seedRand(
    habits.length * 31 + (habits[0]?.id.charCodeAt(0) ?? 7),
  );
  const stars = Array.from({ length: 22 }, () => ({
    left: 2 + rand() * 96,
    top: 2 + rand() * 38,
    size: 2 + Math.floor(rand() * 3),
    delay: rand() * 1.6,
  }));
  const clouds = Array.from({ length: 4 }, (_, i) => ({
    left: 5 + i * 22 + rand() * 6,
    top: 6 + rand() * 18,
    size: 1.4 + rand() * 0.6,
    speed: 40 + rand() * 30,
    delay: rand() * 20,
  }));

  // Butterflies: spawn 1-3 around mature/blooming plants
  const blooming = habits.filter(
    (h) => h.doneToday && stageFor(h.streak) >= 3,
  );
  const butterflies = Array.from(
    { length: Math.min(3, Math.max(1, blooming.length)) },
    (_, i) => ({
      left: 15 + i * 28 + rand() * 8,
      top: 42 + rand() * 18,
      delay: rand() * 4,
      duration: 6 + rand() * 4,
      emoji: ["🦋", "🐝", "🪶"][i % 3],
    }),
  );

  return (
    <div
      className="relative pixel-edge-tight overflow-hidden"
      style={{
        background: SKY_GRADIENTS[phase],
        minHeight: "32rem",
        transition: "background 1500ms ease-in-out",
      }}
    >
      {/* Phase label */}
      <div
        className="absolute top-3 left-3 font-display text-[0.55rem] tracking-widest px-2 py-1 z-20"
        style={{
          background: "rgba(29, 27, 46, 0.6)",
          color: "var(--color-ink)",
          boxShadow: "0 0 0 1px var(--color-border)",
        }}
      >
        {SKY_LABEL[phase]}
      </div>

      {/* Sun / moon */}
      <span
        className="absolute pointer-events-none select-none text-4xl untap-bobble z-10"
        style={{
          right: "1.5rem",
          top: "1rem",
          filter:
            phase === "midday"
              ? "drop-shadow(0 0 14px rgba(245, 200, 158, 0.7))"
              : isDark
                ? "drop-shadow(0 0 10px rgba(245, 200, 158, 0.4))"
                : "drop-shadow(0 0 8px rgba(245, 200, 158, 0.5))",
        }}
      >
        {skyIcon(phase)}
      </span>

      {/* Stars (only at night/dawn/dusk) */}
      {isDark
        ? stars.map((s, i) => (
            <span
              key={`star-${i}`}
              className="absolute pointer-events-none untap-pulse"
              style={{
                left: `${s.left}%`,
                top: `${s.top}%`,
                width: `${s.size}px`,
                height: `${s.size}px`,
                background: "var(--color-ink)",
                boxShadow: "0 0 4px rgba(240, 230, 210, 0.6)",
                animationDelay: `${s.delay}s`,
              }}
            />
          ))
        : null}

      {/* Clouds */}
      {clouds.map((c, i) => (
        <span
          key={`cloud-${i}`}
          className="absolute pointer-events-none select-none"
          style={{
            left: `${c.left}%`,
            top: `${c.top}%`,
            fontSize: `${c.size}rem`,
            opacity: isDark ? 0.25 : 0.5,
            animation: `cloud-drift ${c.speed}s linear infinite`,
            animationDelay: `-${c.delay}s`,
            filter: isDark ? "grayscale(0.5)" : "none",
          }}
        >
          ☁️
        </span>
      ))}

      {/* Distant mountains silhouette */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: 0,
          right: 0,
          top: "32%",
          height: "20%",
          background:
            "linear-gradient(180deg, transparent 0%, transparent 30%, rgba(45, 30, 60, 0.55) 30%, rgba(45, 30, 60, 0.55) 100%)",
          clipPath:
            "polygon(0% 100%, 0% 60%, 10% 40%, 20% 55%, 30% 30%, 40% 50%, 50% 35%, 60% 55%, 70% 40%, 80% 60%, 90% 45%, 100% 65%, 100% 100%)",
        }}
      />

      {/* Wooden fence */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: 0,
          right: 0,
          top: "52%",
          height: "5%",
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "repeating-linear-gradient(90deg, transparent 0 18px, #4a2f18 18px 26px)",
            opacity: 0.85,
          }}
        />
        <div
          className="absolute"
          style={{
            left: 0,
            right: 0,
            top: "55%",
            height: "3px",
            background: "#4a2f18",
          }}
        />
      </div>

      {/* Butterflies / critters */}
      {butterflies.map((b, i) => (
        <span
          key={`bf-${i}`}
          className="absolute pointer-events-none select-none text-base z-10"
          style={{
            left: `${b.left}%`,
            top: `${b.top}%`,
            animation: `butterfly-${i % 3} ${b.duration}s ease-in-out infinite`,
            animationDelay: `${b.delay}s`,
          }}
        >
          {b.emoji}
        </span>
      ))}

      {/* Garden plot grid */}
      <div
        className="absolute z-10"
        style={{
          left: "2.5%",
          right: "2.5%",
          bottom: "1.5rem",
          top: "57%",
        }}
      >
        <div
          className="grid gap-3 h-full content-end"
          style={{
            gridTemplateColumns: `repeat(${Math.min(4, Math.max(2, Math.ceil(Math.sqrt(habits.length))))}, minmax(0, 1fr))`,
          }}
        >
          {habits.map((h) => (
            <GardenPlant key={h.id} habit={h} />
          ))}
        </div>
      </div>

      {/* Grass tufts at bottom */}
      <div
        className="absolute pointer-events-none flex justify-around items-end z-0"
        style={{ left: 0, right: 0, bottom: 0, height: "1rem" }}
      >
        {Array.from({ length: 10 }).map((_, i) => (
          <span
            key={i}
            className="text-sm select-none"
            style={{ opacity: 0.7, filter: "saturate(0.7)" }}
          >
            🌾
          </span>
        ))}
      </div>

      {/* Watering can in corner */}
      <span
        className="absolute pointer-events-none select-none text-3xl z-10 untap-bobble"
        style={{ left: "1rem", bottom: "1.5rem" }}
      >
        🪣
      </span>

      <style>{`
        @keyframes cloud-drift {
          0%   { transform: translateX(0); }
          100% { transform: translateX(120vw); }
        }
        @keyframes butterfly-0 {
          0%, 100% { transform: translate(0, 0); }
          25% { transform: translate(20px, -15px); }
          50% { transform: translate(-10px, -25px); }
          75% { transform: translate(15px, -10px); }
        }
        @keyframes butterfly-1 {
          0%, 100% { transform: translate(0, 0) rotate(0); }
          33% { transform: translate(-25px, -20px) rotate(-8deg); }
          66% { transform: translate(20px, -15px) rotate(8deg); }
        }
        @keyframes butterfly-2 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(30px, -30px); }
        }
      `}</style>
    </div>
  );
}

function GardenPlant({ habit }: { habit: HabitWithStatus }) {
  const [pending, startTransition] = useTransition();
  const sparkle = useSparkleBurst("spark");
  const drops = useSparkleBurst("drop");

  const plant = plantEmoji(
    habit.plantSpecies,
    habit.streak,
    habit.doneToday,
    habit.hasEverBeenDone,
  );
  const stage = stageFor(habit.streak);
  const isWilted = !habit.doneToday && habit.streak === 0 && habit.hasEverBeenDone;
  const thirsty = !habit.doneToday && !isWilted && habit.scheduledToday;
  const offDay = !habit.scheduledToday;

  const sizeClass =
    stage === 4
      ? "text-7xl"
      : stage === 3
        ? "text-6xl"
        : stage === 2
          ? "text-5xl"
          : stage === 1
            ? "text-4xl"
            : "text-3xl";

  function handleWater() {
    if (habit.doneToday || !habit.scheduledToday || pending) return;
    drops.burst();
    sparkle.burst();
    startTransition(async () => {
      emitToggleResult(await toggleToday(habit.id, false));
    });
  }

  return (
    <button
      type="button"
      onClick={handleWater}
      disabled={pending || habit.doneToday || offDay}
      title={`${habit.name} · ${stageLabel(stage)} · racha ${habit.streak}d${habit.doneToday ? " · ya regada hoy" : offDay ? " · hoy no toca" : " · click para regar"}`}
      className="flex flex-col items-center gap-1 group relative"
      style={{ cursor: habit.doneToday || offDay ? "default" : "pointer" }}
    >
      {/* aura for blooming */}
      {stage >= 3 && habit.doneToday ? (
        <span
          className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 text-sm untap-pulse pointer-events-none select-none"
          aria-hidden
        >
          ✨
        </span>
      ) : null}

      {/* anchor crown */}
      {habit.isAnchor ? (
        <span
          className="absolute -top-2 right-1 text-base select-none pointer-events-none"
          style={{ filter: "drop-shadow(0 0 4px rgba(245, 200, 158, 0.8))" }}
        >
          👑
        </span>
      ) : null}

      {/* plant */}
      <span
        className={`${sizeClass} ${habit.doneToday ? "untap-bobble" : ""} relative select-none transition-transform`}
        style={{
          opacity: offDay ? 0.35 : thirsty ? 0.55 : 1,
          filter: isWilted
            ? "saturate(0.4) brightness(0.8)"
            : habit.doneToday
              ? "drop-shadow(0 0 8px rgba(168, 216, 184, 0.5))"
              : "none",
          transition: "opacity 200ms",
        }}
      >
        {plant}
        <SparkleLayer particles={sparkle.particles} />
        <SparkleLayer particles={drops.particles} />
      </span>

      {/* dirt plot */}
      <div
        className="relative w-20 h-3"
        style={{
          background:
            "repeating-linear-gradient(90deg, #4a2f18 0 4px, #3a2410 4px 8px)",
          boxShadow:
            "inset 0 -2px 0 rgba(0,0,0,0.45), inset 0 2px 0 rgba(255,255,255,0.06), 0 0 0 1px #2a1a08",
        }}
      >
        <span className="absolute" style={{ left: "20%", top: "30%", width: 2, height: 2, background: "#6b4423" }} />
        <span className="absolute" style={{ right: "25%", top: "55%", width: 2, height: 2, background: "#5a3a1f" }} />
      </div>

      {/* wooden sign */}
      <div
        className="relative px-2 py-0.5 mt-1 max-w-[10rem]"
        style={{
          background: "linear-gradient(180deg, #8b5a2a 0%, #6b4423 100%)",
          boxShadow:
            "0 0 0 2px #3a2410, inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -2px 0 rgba(0,0,0,0.25)",
        }}
      >
        <div className="text-xs text-[var(--color-ink)] truncate font-display tracking-wider">
          {habit.name}
        </div>
        <div className="text-[0.55rem] text-[var(--color-peach)] font-display tracking-wider">
          🔥 {habit.streak}D · {stageLabel(stage).toUpperCase()}
        </div>
      </div>
    </button>
  );
}
