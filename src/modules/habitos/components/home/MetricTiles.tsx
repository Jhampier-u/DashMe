import { weekdayName } from "@/modules/habitos/lib/stats";
import { formatDays } from "@/modules/habitos/lib/day";
import { Stat, StatGrid } from "@/modules/core/ui/Stat";
import type { WeekdayRate } from "@/modules/habitos/lib/metrics";

type Props = {
  streak: { days: number; habitName: string } | null;
  best: WeekdayRate | null;
  level: number;
  xp: number;
  xpToNext: number;
  shields: number;
  maxShields: number;
};

export function MetricTiles(p: Props) {
  return (
    <StatGrid>
      <Stat
        label="Racha activa"
        value={p.streak ? formatDays(p.streak.days) : "—"}
        meta={p.streak ? p.streak.habitName : "sin rachas abiertas"}
      />
      <Stat
        label="Mejor día"
        value={p.best ? weekdayName(p.best.weekday) : "—"}
        meta={p.best ? `${Math.round(p.best.rate * 100)}% de cumplimiento` : "aún sin datos"}
      />
      <Stat
        label="Nivel"
        value={String(p.level)}
        meta={`${p.xp} XP · ${p.xpToNext} para el ${p.level + 1}`}
      />
      <Stat label="Escudos" value={`${p.shields} / ${p.maxShields}`} meta="disponibles" />
    </StatGrid>
  );
}
