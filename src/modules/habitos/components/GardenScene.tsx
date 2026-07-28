"use client";

import { useTransition } from "react";
import type { HabitWithStatus } from "@/modules/habitos/lib/habits";
import { useLocalHour } from "@/modules/habitos/lib/useLocalHour";
import { isPlantWilted, plantEmoji, plantStateLabel, stageFor } from "@/modules/habitos/lib/garden";
import { habitColorVar, resolveHabitColor } from "@/modules/habitos/lib/color";
import { formatDays } from "@/modules/habitos/lib/day";
import { toggleToday } from "@/modules/habitos/actions";
import { emitToggleResult } from "@/modules/habitos/lib/events";
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

/** Donde acaba el cielo y empieza la tierra. */
const HORIZON = "62%";

// Cielo y suelo van en capas separadas. Antes compartían un mismo degradado con
// una parada dura en el horizonte, y esa parada era el bandeado pixel.
const SKY: Record<SkyPhase, string> = {
  dawn: "linear-gradient(180deg, #2b2440 0%, #6b4f74 45%, #c98f6d 100%)",
  morning: "linear-gradient(180deg, #4a6f9e 0%, #7fa3c9 50%, #cfd9e2 100%)",
  midday: "linear-gradient(180deg, #3d7ab5 0%, #6ba3d4 50%, #bcd8ea 100%)",
  afternoon: "linear-gradient(180deg, #55749e 0%, #8f9cba 50%, #d9b48f 100%)",
  dusk: "linear-gradient(180deg, #241d38 0%, #6d5480 45%, #c07f92 100%)",
  night: "linear-gradient(180deg, #0c0c14 0%, #16162a 55%, #232144 100%)",
};

const GROUND: Record<SkyPhase, string> = {
  dawn: "linear-gradient(180deg, #3a4a2c 0%, #26301c 100%)",
  morning: "linear-gradient(180deg, #46603a 0%, #2c3d24 100%)",
  midday: "linear-gradient(180deg, #4d6b3d 0%, #314426 100%)",
  afternoon: "linear-gradient(180deg, #445c36 0%, #2b3a22 100%)",
  dusk: "linear-gradient(180deg, #2f3a24 0%, #1e2617 100%)",
  night: "linear-gradient(180deg, #1b2416 0%, #121810 100%)",
};

// El amanecer y el atardecer también cuentan como "oscuros" para las estrellas,
// así que el icono no puede deducirse de isDark — antes el 🌅 nunca salía.
function skyIcon(phase: SkyPhase): string {
  if (phase === "dawn" || phase === "dusk") return "🌅";
  if (phase === "night") return "🌙";
  return "☀️";
}

const SKY_LABEL: Record<SkyPhase, string> = {
  dawn: "Amanecer",
  morning: "Mañana",
  midday: "Mediodía",
  afternoon: "Tarde",
  dusk: "Atardecer",
  night: "Noche",
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

  // Sembrado con los hábitos: la escena no baila en cada render.
  const rand = seedRand(habits.length * 31 + (habits[0]?.id.charCodeAt(0) ?? 7));
  const stars = Array.from({ length: 22 }, () => ({
    left: 2 + rand() * 96,
    top: 2 + rand() * 38,
    size: 2 + Math.floor(rand() * 2),
    delay: rand() * 1.6,
  }));
  const clouds = Array.from({ length: 4 }, (_, i) => ({
    left: 5 + i * 22 + rand() * 6,
    top: 6 + rand() * 18,
    size: 1.4 + rand() * 0.6,
    speed: 40 + rand() * 30,
    delay: rand() * 20,
  }));

  const columns = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(habits.length))));
  const fade = "background 1500ms ease-in-out";

  return (
    <div
      style={{
        position: "relative",
        borderRadius: 12,
        overflow: "hidden",
        minHeight: "30rem",
      }}
    >
      <div style={{ position: "absolute", inset: 0, background: SKY[phase], transition: fade }} />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: HORIZON,
          bottom: 0,
          background: GROUND[phase],
          transition: fade,
        }}
      />

      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          zIndex: 20,
          padding: "3px 9px",
          borderRadius: 999,
          background: "rgba(0, 0, 0, 0.35)",
          color: "var(--m-ink)",
          fontSize: 11,
        }}
      >
        {SKY_LABEL[phase]}
      </div>

      <span
        aria-hidden
        style={{
          position: "absolute",
          right: 20,
          top: 14,
          zIndex: 10,
          fontSize: 32,
          pointerEvents: "none",
          userSelect: "none",
          filter:
            phase === "midday"
              ? "drop-shadow(0 0 14px rgba(245, 200, 158, 0.7))"
              : "drop-shadow(0 0 10px rgba(245, 200, 158, 0.4))",
        }}
      >
        {skyIcon(phase)}
      </span>

      {isDark
        ? stars.map((s, i) => (
            <span
              key={`star-${i}`}
              className="untap-pulse"
              aria-hidden
              style={{
                position: "absolute",
                left: `${s.left}%`,
                top: `${s.top}%`,
                width: s.size,
                height: s.size,
                borderRadius: "50%",
                background: "#f2f2f5",
                boxShadow: "0 0 4px rgba(242, 242, 245, 0.6)",
                animationDelay: `${s.delay}s`,
                pointerEvents: "none",
              }}
            />
          ))
        : null}

      {clouds.map((c, i) => (
        <span
          key={`cloud-${i}`}
          aria-hidden
          style={{
            position: "absolute",
            left: `${c.left}%`,
            top: `${c.top}%`,
            fontSize: `${c.size}rem`,
            opacity: isDark ? 0.22 : 0.45,
            animation: `cloud-drift ${c.speed}s linear infinite`,
            animationDelay: `-${c.delay}s`,
            filter: isDark ? "grayscale(0.5)" : "none",
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          ☁️
        </span>
      ))}

      <div
        style={{
          position: "absolute",
          left: "3%",
          right: "3%",
          top: "58%",
          bottom: "1.25rem",
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            gap: 12,
            height: "100%",
            alignContent: "end",
          }}
        >
          {habits.map((h) => (
            <GardenPlant key={h.id} habit={h} />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes cloud-drift {
          0%   { transform: translateX(0); }
          100% { transform: translateX(120vw); }
        }
      `}</style>
    </div>
  );
}

/** Tamaño del emoji por etapa: la planta crece de verdad al subir la racha. */
const PLANT_SIZE = [30, 38, 48, 60, 72];

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
  const isWilted = isPlantWilted(
    habit.streak,
    habit.doneToday,
    habit.hasEverBeenDone,
  );
  const estado = plantStateLabel(
    habit.streak,
    habit.doneToday,
    habit.hasEverBeenDone,
  );
  const thirsty = !habit.doneToday && !isWilted && habit.scheduledToday;
  const offDay = !habit.scheduledToday;
  const accent = habitColorVar(resolveHabitColor(habit.color));

  function handleWater() {
    if (habit.doneToday || !habit.scheduledToday || pending) return;
    drops.burst();
    sparkle.burst();
    startTransition(async () => {
      emitToggleResult(await toggleToday(habit.id, false));
    });
  }

  const situacion = habit.doneToday
    ? "ya regada hoy"
    : offDay
      ? "hoy no toca"
      : "click para regar";

  return (
    <button
      type="button"
      onClick={handleWater}
      disabled={pending || habit.doneToday || offDay}
      title={`${habit.name} · ${estado} · racha de ${formatDays(habit.streak)} · ${situacion}`}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        background: "transparent",
        border: 0,
        padding: 0,
        fontFamily: "inherit",
        cursor: habit.doneToday || offDay ? "default" : "pointer",
      }}
    >
      {stage >= 3 && habit.doneToday ? (
        <span
          className="untap-pulse"
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translate(-50%, -8px)",
            fontSize: 13,
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          ✨
        </span>
      ) : null}

      {habit.isAnchor ? (
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: -8,
            right: 4,
            fontSize: 14,
            pointerEvents: "none",
            userSelect: "none",
            filter: "drop-shadow(0 0 4px rgba(245, 200, 158, 0.8))",
          }}
        >
          👑
        </span>
      ) : null}

      <span
        className={habit.doneToday ? "untap-bobble" : undefined}
        aria-hidden
        style={{
          position: "relative",
          fontSize: PLANT_SIZE[stage],
          lineHeight: 1,
          userSelect: "none",
          opacity: offDay ? 0.35 : thirsty ? 0.55 : 1,
          filter: isWilted
            ? "saturate(0.4) brightness(0.8)"
            : habit.doneToday
              ? "drop-shadow(0 0 8px rgba(25, 158, 112, 0.5))"
              : "none",
          transition: "opacity 200ms",
        }}
      >
        {plant}
        <SparkleLayer particles={sparkle.particles} />
        <SparkleLayer particles={drops.particles} />
      </span>

      <div
        aria-hidden
        style={{
          width: 72,
          height: 7,
          borderRadius: 4,
          marginTop: 4,
          background: "linear-gradient(180deg, #5a4028 0%, #3b2a1a 100%)",
        }}
      />

      <div
        style={{
          marginTop: 6,
          maxWidth: "9rem",
          padding: "4px 8px",
          borderRadius: 7,
          background: "rgba(0, 0, 0, 0.4)",
          borderLeft: `3px solid ${accent}`,
          textAlign: "left",
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: "var(--m-ink)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {habit.name}
        </div>
        <div className="m-num" style={{ fontSize: 10.5, color: "var(--m-ink-2)" }}>
          {habit.streak} d · {estado}
        </div>
      </div>
    </button>
  );
}
