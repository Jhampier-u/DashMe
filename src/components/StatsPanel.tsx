import type { GlobalStats } from "@/lib/stats";
import { weekdayName } from "@/lib/stats";
import { PixelWindow } from "./PixelWindow";

type Props = { stats: GlobalStats };

function colorForCount(count: number, max: number) {
  if (count === 0) return "var(--color-bg-deep)";
  const intensity = max === 0 ? 0 : Math.min(1, count / Math.max(2, max));
  if (intensity > 0.75) return "var(--color-mint)";
  if (intensity > 0.5) return "var(--color-peach)";
  if (intensity > 0.25) return "var(--color-lavender)";
  return "var(--color-sky)";
}

const WEEKDAY_INITIALS = ["D", "L", "M", "M", "J", "V", "S"];

export function StatsPanel({ stats }: Props) {
  const max = stats.weeks
    .flat()
    .reduce((m, d) => Math.max(m, d.count), 0);

  return (
    <PixelWindow title="Tu progreso · 12 semanas">
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Mini label="HOY" value={stats.todayCompletions} />
        <Mini label="ESTA SEMANA" value={stats.weekCompletions} />
        <Mini label="TOTAL" value={stats.totalCompletions} />
      </div>

      {/* Cada columna es una semana real y cada fila un día de la semana. */}
      <div className="flex gap-1 justify-center mb-2 overflow-x-auto">
        <div className="flex flex-col gap-1 mr-1">
          {WEEKDAY_INITIALS.map((d, i) => (
            <div
              key={i}
              className="w-3 h-3 font-display text-[0.4rem] leading-3 text-[var(--color-ink-dim)] text-center"
            >
              {i % 2 === 1 ? d : ""}
            </div>
          ))}
        </div>
        {stats.weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((day) => (
              <div
                key={day.date}
                title={
                  day.isFuture
                    ? day.date
                    : `${day.date} · ${day.count} hábito${day.count === 1 ? "" : "s"}`
                }
                className="w-3 h-3"
                style={{
                  background: day.isFuture
                    ? "transparent"
                    : colorForCount(day.count, max),
                  boxShadow: day.isFuture
                    ? "0 0 0 1px var(--color-surface)"
                    : "0 0 0 1px var(--color-border)",
                }}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="flex justify-between text-[0.6rem] font-display tracking-wider text-[var(--color-ink-dim)] mt-2">
        <span>HACE 12 SEMANAS</span>
        <span>HOY</span>
      </div>

      {stats.bestWeekday ? (
        <div className="text-center text-[var(--color-ink-soft)] text-base mt-4">
          Día más productivo:{" "}
          <span className="text-[var(--color-peach)] font-display text-sm">
            {weekdayName(stats.bestWeekday.weekday).toUpperCase()}
          </span>{" "}
          ({stats.bestWeekday.count} cumplimientos)
        </div>
      ) : null}
    </PixelWindow>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="p-3 text-center pixel-edge-tight"
      style={{ background: "var(--color-bg-deep)" }}
    >
      <div className="font-display text-[0.55rem] text-[var(--color-ink-dim)] mb-1 tracking-wider">
        {label}
      </div>
      <div className="font-display text-xl text-[var(--color-mint)]">{value}</div>
    </div>
  );
}
