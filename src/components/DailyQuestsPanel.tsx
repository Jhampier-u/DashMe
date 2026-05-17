import { PixelWindow } from "./PixelWindow";
import { QUEST_DEFS, type DailyQuestRow } from "@/lib/quests";

type Props = { quests: DailyQuestRow[] };

export function DailyQuestsPanel({ quests }: Props) {
  if (quests.length === 0) return null;
  const completedCount = quests.filter((q) => q.completed).length;

  return (
    <PixelWindow
      title={`Misiones de hoy · ${completedCount}/${quests.length}`}
    >
      <ul className="flex flex-col gap-2">
        {quests.map((q) => {
          const def = QUEST_DEFS[q.kind];
          const pct = q.completed ? 1 : Math.min(1, q.progress / q.target);
          return (
            <li
              key={q.id}
              className="flex items-center gap-3 p-3 pixel-edge-tight"
              style={{
                background: q.completed
                  ? "var(--color-mint)"
                  : "var(--color-bg-deep)",
                color: q.completed ? "var(--color-bg-deep)" : "var(--color-ink)",
                opacity: q.completed ? 0.85 : 1,
              }}
            >
              <span className="text-2xl">{def.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <span className="font-display text-[0.65rem] tracking-wider truncate">
                    {def.label.toUpperCase()}
                  </span>
                  <span className="text-base font-display whitespace-nowrap">
                    {q.completed ? "✓" : `${q.progress}/${q.target}`}
                  </span>
                </div>
                <div className="text-sm opacity-80">{def.description}</div>
                <div
                  className="h-2 mt-2"
                  style={{
                    background: q.completed
                      ? "rgba(29, 27, 46, 0.3)"
                      : "var(--color-surface)",
                    boxShadow: "0 0 0 1px var(--color-border)",
                  }}
                >
                  <div
                    className="h-full"
                    style={{
                      width: `${Math.round(pct * 100)}%`,
                      background: q.completed
                        ? "var(--color-bg-deep)"
                        : "var(--color-peach)",
                      transition: "width 300ms steps(8)",
                    }}
                  />
                </div>
              </div>
              <span
                className="font-display text-[0.6rem] whitespace-nowrap"
                style={{
                  color: q.completed
                    ? "var(--color-bg-deep)"
                    : "var(--color-peach)",
                }}
              >
                +{q.xpReward} XP
              </span>
            </li>
          );
        })}
      </ul>
    </PixelWindow>
  );
}
