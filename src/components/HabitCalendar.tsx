"use client";

type Props = {
  last30: boolean[]; // index 0 = today, index 29 = 29 days ago
};

// Render as 30 cells grouped from oldest (left) to today (right), 10 columns x 3 rows
export function HabitCalendar({ last30 }: Props) {
  const ordered = [...last30].reverse(); // oldest first

  return (
    <div className="flex flex-col gap-1 mt-2">
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: "repeat(15, minmax(0, 1fr))" }}
      >
        {ordered.map((done, i) => {
          const daysAgo = 29 - i;
          return (
            <div
              key={i}
              title={daysAgo === 0 ? "hoy" : `hace ${daysAgo}d`}
              className="aspect-square"
              style={{
                background: done ? "var(--color-mint)" : "var(--color-bg-deep)",
                boxShadow: "0 0 0 1px var(--color-border)",
              }}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-[0.65rem] text-[var(--color-ink-dim)] font-display tracking-wider mt-1">
        <span>HACE 30D</span>
        <span>HOY</span>
      </div>
    </div>
  );
}
