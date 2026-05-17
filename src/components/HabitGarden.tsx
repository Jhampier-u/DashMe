import type { HabitWithStatus } from "@/lib/habits";
import { plantEmoji, stageFor, stageLabel } from "@/lib/garden";
import { PixelWindow } from "./PixelWindow";

type Props = { habits: HabitWithStatus[] };

// Deterministic pseudo-random for stable star/cloud positions per habit count.
function seedRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

const STAR_COUNT = 14;
const CLOUD_COUNT = 2;

export function HabitGarden({ habits }: Props) {
  if (habits.length === 0) return null;

  const rand = seedRand(habits.length * 31 + habits[0].id.charCodeAt(0));
  const stars = Array.from({ length: STAR_COUNT }, () => ({
    left: 4 + rand() * 92,
    top: 4 + rand() * 50,
    size: 2 + Math.floor(rand() * 3),
    delay: rand() * 1.4,
  }));
  const clouds = Array.from({ length: CLOUD_COUNT }, (_, i) => ({
    left: 8 + i * 55 + rand() * 8,
    top: 8 + rand() * 18,
  }));

  return (
    <PixelWindow title="Tu jardín">
      <div
        className="relative pixel-edge-tight overflow-hidden"
        style={{
          // Layered night sky → indigo → grass-line → dark soil
          background:
            "linear-gradient(180deg, #1d1b2e 0%, #2a1f4a 35%, #3a2a5e 60%, #2d4a25 60%, #1f3318 78%, #2a1f10 78%, #1a1408 100%)",
          minHeight: "13rem",
        }}
      >
        {/* Stars */}
        {stars.map((s, i) => (
          <span
            key={`star-${i}`}
            className="absolute pointer-events-none untap-pulse"
            style={{
              left: `${s.left}%`,
              top: `${s.top}%`,
              width: `${s.size}px`,
              height: `${s.size}px`,
              background: "var(--color-ink)",
              boxShadow: "0 0 4px rgba(240, 230, 210, 0.5)",
              animationDelay: `${s.delay}s`,
            }}
          />
        ))}

        {/* Clouds (subtle) */}
        {clouds.map((c, i) => (
          <span
            key={`cloud-${i}`}
            className="absolute pointer-events-none text-2xl select-none"
            style={{
              left: `${c.left}%`,
              top: `${c.top}%`,
              opacity: 0.35,
              filter: "grayscale(0.4)",
            }}
          >
            ☁️
          </span>
        ))}

        {/* Moon top-right */}
        <span
          className="absolute pointer-events-none select-none text-3xl untap-bobble"
          style={{ right: "1rem", top: "0.6rem", filter: "drop-shadow(0 0 8px rgba(245, 200, 158, 0.4))" }}
        >
          🌙
        </span>

        {/* Distant fence silhouette */}
        <div
          className="absolute pointer-events-none"
          style={{
            left: 0,
            right: 0,
            bottom: "calc(40% - 6px)",
            height: "6px",
            background:
              "repeating-linear-gradient(90deg, transparent 0 8px, rgba(45, 30, 15, 0.6) 8px 12px)",
          }}
        />

        {/* Plants row */}
        <div
          className="relative flex items-end justify-around gap-2 flex-wrap pt-12 pb-2"
          style={{ minHeight: "13rem" }}
        >
          {habits.map((h) => {
            const plant = plantEmoji(
              h.plantSpecies,
              h.streak,
              h.doneToday,
              h.hasEverBeenDone,
            );
            const stage = stageFor(h.streak);
            const sizeClass =
              stage === 4
                ? "text-6xl"
                : stage === 3
                  ? "text-5xl"
                  : stage === 2
                    ? "text-4xl"
                    : stage === 1
                      ? "text-3xl"
                      : "text-2xl";
            const isWilted = !h.doneToday && h.streak === 0 && h.hasEverBeenDone;
            const thirsty = !h.doneToday && !isWilted;

            return (
              <div
                key={h.id}
                className="flex flex-col items-center gap-1 px-2 z-10"
                title={`${h.name} · ${stageLabel(stage)} · racha ${h.streak}d`}
              >
                {/* sparkle aura for mature plants */}
                {stage >= 3 && h.doneToday ? (
                  <span
                    className="absolute -translate-y-2 text-sm untap-pulse pointer-events-none select-none"
                    aria-hidden
                  >
                    ✨
                  </span>
                ) : null}

                {/* plant */}
                <span
                  className={`${sizeClass} ${h.doneToday ? "untap-bobble" : ""} select-none`}
                  style={{
                    opacity: thirsty ? 0.55 : 1,
                    filter: isWilted ? "saturate(0.4) brightness(0.8)" : "none",
                    textShadow: h.doneToday
                      ? "0 0 10px rgba(168, 216, 184, 0.4)"
                      : "none",
                    transition: "opacity 200ms",
                  }}
                >
                  {plant}
                </span>

                {/* dirt plot */}
                <div
                  className="relative"
                  style={{
                    width: "3.5rem",
                    height: "0.75rem",
                    background:
                      "repeating-linear-gradient(90deg, #4a2f18 0 3px, #3a2410 3px 6px)",
                    boxShadow:
                      "inset 0 -2px 0 rgba(0,0,0,0.4), inset 0 2px 0 rgba(255,255,255,0.05), 0 0 0 1px #2a1a08",
                    borderTopLeftRadius: 1,
                    borderTopRightRadius: 1,
                  }}
                >
                  {/* tiny pebbles */}
                  <span
                    className="absolute"
                    style={{
                      left: "20%",
                      top: "30%",
                      width: "2px",
                      height: "2px",
                      background: "#6b4423",
                    }}
                  />
                  <span
                    className="absolute"
                    style={{
                      right: "25%",
                      top: "55%",
                      width: "2px",
                      height: "2px",
                      background: "#5a3a1f",
                    }}
                  />
                </div>

                {/* label */}
                <span className="text-xs text-[var(--color-ink)] truncate max-w-[6rem] mt-1 drop-shadow">
                  {h.name}
                </span>
                <span className="font-display text-[0.55rem] text-[var(--color-peach)] tracking-wider">
                  🔥 {h.streak}D · {stageLabel(stage).toUpperCase()}
                </span>
              </div>
            );
          })}
        </div>

        {/* Foreground grass tufts */}
        <div
          className="absolute pointer-events-none flex justify-around items-end px-3 pb-1"
          style={{ left: 0, right: 0, bottom: 0 }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <span
              key={i}
              className="text-xs select-none"
              style={{ opacity: 0.7, filter: "saturate(0.6)" }}
            >
              🌾
            </span>
          ))}
        </div>
      </div>

      <div className="text-[0.6rem] font-display tracking-wider text-[var(--color-ink-dim)] text-center mt-3">
        SEMILLA · BROTE · JOVEN · MADURA · FLORECIENTE · 🥀 marchita si rompes la racha · transparente = sin regar hoy
      </div>
    </PixelWindow>
  );
}
