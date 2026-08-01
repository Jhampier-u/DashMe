"use client";

import { useTransition, type CSSProperties } from "react";
import type { HabitWithStatus } from "@/modules/habitos/lib/habits";
import { useLocalHour } from "@/modules/habitos/lib/useLocalHour";
import { ETIQUETA, type Tiempo } from "@/modules/habitos/lib/clima";
import { isPlantWilted, plantEmoji, plantStateLabel, stageFor } from "@/modules/habitos/lib/garden";
import { Sprite } from "@/modules/core/ui/pixel/Sprite";
import { FLOR, FLOR_MARCHITA } from "@/modules/habitos/lib/sprites/flor";
import { habitColorVar, resolveHabitColor } from "@/modules/habitos/lib/color";
import { formatDays } from "@/modules/habitos/lib/day";
import { toggleToday } from "@/modules/habitos/actions";
import { emitToggleResult } from "@/modules/habitos/lib/events";
import { useSparkleBurst, SparkleLayer } from "./Sparkle";

type Props = { habits: HabitWithStatus[]; tiempo: Tiempo };

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

// Cielo y suelo van en capas separadas para poder darle al horizonte su propio
// trazo.
//
// Las paradas son DURAS a propósito: `a 0 34%, b 34% 67%` pinta tres franjas
// planas en vez de interpolarlas. Ese bandeado es lo que hace que la escena sea
// pixel art conservando sus seis fases —la noche sigue siendo noche—, y es justo
// lo contrario de lo que buscaba la versión anterior, que lo trataba como un
// defecto a evitar. Si te dan ganas de suavizarlo, es que no has leído esto.
//
// Los colores son los mismos de siempre. Lo único que cambió es cómo se reparten.
const SKY: Record<SkyPhase, string> = {
  dawn: "linear-gradient(180deg, #2b2440 0 34%, #6b4f74 34% 67%, #c98f6d 67% 100%)",
  morning: "linear-gradient(180deg, #4a6f9e 0 34%, #7fa3c9 34% 67%, #cfd9e2 67% 100%)",
  midday: "linear-gradient(180deg, #3d7ab5 0 34%, #6ba3d4 34% 67%, #bcd8ea 67% 100%)",
  afternoon: "linear-gradient(180deg, #55749e 0 34%, #8f9cba 34% 67%, #d9b48f 67% 100%)",
  dusk: "linear-gradient(180deg, #241d38 0 34%, #6d5480 34% 67%, #c07f92 67% 100%)",
  night: "linear-gradient(180deg, #0c0c14 0 34%, #16162a 34% 67%, #232144 67% 100%)",
};

const GROUND: Record<SkyPhase, string> = {
  dawn: "linear-gradient(180deg, #3a4a2c 0 50%, #26301c 50% 100%)",
  morning: "linear-gradient(180deg, #46603a 0 50%, #2c3d24 50% 100%)",
  midday: "linear-gradient(180deg, #4d6b3d 0 50%, #314426 50% 100%)",
  afternoon: "linear-gradient(180deg, #445c36 0 50%, #2b3a22 50% 100%)",
  dusk: "linear-gradient(180deg, #2f3a24 0 50%, #1e2617 50% 100%)",
  night: "linear-gradient(180deg, #1b2416 0 50%, #121810 50% 100%)",
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

/*
  Todo lo que se pone encima de la escena va en papel con tinta. Es lo único que
  garantiza contraste sobre seis cielos distintos: 9,76:1 tanto sobre el
  mediodía como sobre la medianoche. Las cápsulas negras translúcidas de antes
  dependían de que el cielo fuera claro.
*/
const PEGATINA: CSSProperties = {
  background: "var(--color-paper)",
  color: "var(--color-tinta)",
  border: "2px solid var(--color-line)",
  fontFamily: "var(--font-cuerpo)",
};

function seedRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

export function GardenScene({ habits, tiempo }: Props) {
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
  /*
    Las nubes ya no son cuatro fijas: son las que le tocan a tu semana. Cero si
    está despejado, cuatro si llueve. La cantidad ES la señal, para que el estado
    no dependa de distinguir un emoji pequeño.
  */
  const clouds = Array.from({ length: tiempo.nubes }, (_, i) => ({
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
        // La escena se lee como una lámina puesta sobre el papel.
        border: "3px solid var(--color-line)",
        borderRadius: "var(--radius-card)",
        boxShadow: "var(--shadow-hard)",
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
          // El horizonte era el único corte duro de la escena y por eso se leía
          // como horizonte. Ahora hay tres más arriba, así que se marca.
          borderTop: "3px solid var(--color-line)",
          transition: fade,
        }}
      />

      <div
        style={{
          ...PEGATINA,
          position: "absolute",
          top: 12,
          left: 12,
          zIndex: 20,
          padding: "3px 9px",
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 700,
        }}
      >
        {SKY_LABEL[phase]}
      </div>

      {/*
        El tiempo va en TEXTO, no solo en la forma de las nubes: es la regla del
        rediseño —nunca una sola señal— y aquí además el emoji es diminuto.

        El `title` dice de dónde sale el dato, para que «Lluvia» no se lea como un
        juicio sobre ti sino como el recuento que es.
      */}
      <div
        title={
          tiempo.evaluables === 0
            ? "Aún no hay días que evaluar esta semana"
            : `${tiempo.cumplidos} de ${tiempo.evaluables} días cumplidos esta semana`
        }
        style={{
          ...PEGATINA,
          position: "absolute",
          top: 12,
          right: 12,
          zIndex: 20,
          padding: "3px 9px",
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 700,
        }}
      >
        {ETIQUETA[tiempo.estado]}
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
                // Cuadradas y sin halo: un píxel no tiene esquinas redondeadas
                // ni resplandor.
                background: "#f2f2f5",
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
          {tiempo.estado === "lluvia" ? "🌧️" : "☁️"}
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
  const gridFlor =
    habit.plantSpecies === "flower"
      ? isPlantWilted(habit.streak, habit.doneToday, habit.hasEverBeenDone)
        ? FLOR_MARCHITA
        : FLOR[stageFor(habit.streak)]
      : null;

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
        {/*
          La flor ya está dibujada; las otras cuatro especies siguen en emoji
          hasta que les toque. Es un estado intermedio a propósito: enseñar el
          estilo con un sprite antes de dibujar los veinte que faltan.
        */}
        {gridFlor ? (
          <Sprite
            grid={gridFlor}
            size={PLANT_SIZE[stage]}
            /* Vacío porque el `aria-label` lo pone el botón de fuera, que es lo
               que se pulsa: repetirlo aquí lo diría dos veces. */
            label=""
          />
        ) : (
          plant
        )}
        <SparkleLayer particles={sparkle.particles} />
        <SparkleLayer particles={drops.particles} />
      </span>

      <div
        aria-hidden
        style={{
          width: 72,
          height: 8,
          marginTop: 4,
          // Plana y con esquinas: sin radio y sin degradado.
          background: "#3b2a1a",
          border: "2px solid var(--color-line)",
        }}
      />

      <div
        style={{
          ...PEGATINA,
          marginTop: 6,
          maxWidth: "9rem",
          padding: "5px 8px",
          borderRadius: "var(--radius-control)",
          // El filo de color es identidad de hábito y sigue cumpliendo la misma
          // función que en la fila.
          borderLeft: `6px solid ${accent}`,
          textAlign: "left",
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {habit.name}
        </div>
        {/* La racha es un dato: VT323 en su suelo de 16px. */}
        <div
          style={{
            fontFamily: "var(--font-vt)",
            fontSize: 16,
            lineHeight: 1.1,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {habit.streak} d · {estado}
        </div>
      </div>
    </button>
  );
}
