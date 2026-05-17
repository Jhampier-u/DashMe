import type { HabitWithStatus } from "@/lib/habits";

type Props = { habits: HabitWithStatus[] };

export function CriticalDayBanner({ habits }: Props) {
  const critical = habits.filter((h) => h.criticalToday);
  if (critical.length === 0) return null;

  return (
    <div
      className="p-4 pixel-edge-tight untap-pulse flex items-center gap-3"
      style={{
        background: "var(--color-pink)",
        color: "var(--color-bg-deep)",
      }}
    >
      <span className="text-3xl">⚠️</span>
      <div className="flex-1">
        <div className="font-display text-[0.7rem] tracking-widest mb-1">
          DÍA CRÍTICO · REGLA DE LOS 2 DÍAS
        </div>
        <div className="text-base">
          Fallaste ayer en{" "}
          <strong>
            {critical.length} hábito{critical.length === 1 ? "" : "s"}
          </strong>
          . NO falles hoy o se rompe la racha:
        </div>
        <ul className="mt-2 flex flex-wrap gap-2">
          {critical.map((h) => (
            <li
              key={h.id}
              className="text-sm font-display tracking-wider px-2 py-1"
              style={{
                background: "rgba(29, 27, 46, 0.2)",
                boxShadow: "0 0 0 1px var(--color-bg-deep)",
              }}
            >
              {h.icon} {h.name.toUpperCase()}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
