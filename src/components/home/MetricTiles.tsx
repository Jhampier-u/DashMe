import { weekdayName } from "@/lib/stats";
import type { WeekdayRate } from "@/lib/metrics";

type Props = {
  streak: { days: number; habitName: string } | null;
  best: WeekdayRate | null;
  level: number;
  xp: number;
  xpToNext: number;
  shields: number;
  maxShields: number;
};

function Tile({ k, v, m }: { k: string; v: string; m: string }) {
  return (
    <div className="m-card" style={{ padding: "13px 14px" }}>
      <div className="m-label">{k}</div>
      <div className="m-num" style={{ fontSize: 21, fontWeight: 600, marginTop: 6, letterSpacing: "-0.02em" }}>
        {v}
      </div>
      <div style={{ fontSize: 11.5, color: "var(--m-ink-2)", marginTop: 3 }}>{m}</div>
    </div>
  );
}

export function MetricTiles(p: Props) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        gap: 10,
      }}
    >
      <Tile
        k="Racha activa"
        v={p.streak ? `${p.streak.days} ${p.streak.days === 1 ? "día" : "días"}` : "—"}
        m={p.streak ? p.streak.habitName : "sin rachas abiertas"}
      />
      <Tile
        k="Mejor día"
        v={p.best ? weekdayName(p.best.weekday) : "—"}
        m={p.best ? `${Math.round(p.best.rate * 100)}% de cumplimiento` : "aún sin datos"}
      />
      <Tile k="Nivel" v={String(p.level)} m={`${p.xp} XP · ${p.xpToNext} para el ${p.level + 1}`} />
      <Tile k="Escudos" v={`${p.shields} / ${p.maxShields}`} m="disponibles" />
    </div>
  );
}
