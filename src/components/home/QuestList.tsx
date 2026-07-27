import { QUEST_DEFS, type DailyQuestRow } from "@/lib/quests";

export function QuestList({ quests }: { quests: DailyQuestRow[] }) {
  if (quests.length === 0) return null;
  const done = quests.filter((q) => q.completed).length;

  return (
    <div className="m-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
        <span className="m-label">Objetivos del día</span>
        <span className="m-num" style={{ fontSize: 12, color: "var(--m-ink-3)" }}>
          {done}/{quests.length}
        </span>
      </div>

      {quests.map((q) => {
        const def = QUEST_DEFS[q.kind];
        const ratio = q.completed ? 1 : Math.min(1, q.progress / q.target);
        return (
          <div key={q.id} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 6 }}>
              <span style={{ color: q.completed ? "var(--m-ink-3)" : "var(--m-ink)" }}>
                {def.description}
              </span>
              <span className="m-num" style={{ color: "var(--m-ink-3)" }}>
                {q.completed ? `+${q.xpReward} XP` : `${q.progress}/${q.target}`}
              </span>
            </div>
            <div style={{ height: 4, background: "var(--m-track)", borderRadius: 2 }}>
              <div
                style={{
                  height: "100%",
                  width: `${ratio * 100}%`,
                  background: q.completed ? "var(--m-good)" : "var(--m-series)",
                  borderRadius: 2,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
