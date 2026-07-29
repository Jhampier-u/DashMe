import { Card } from "@/modules/core/ui/Card";
import { ProgressBar } from "@/modules/core/ui/ProgressBar";
import { QUEST_DEFS, type DailyQuestRow } from "@/modules/habitos/lib/quests";

/*
  Esta pieza no estaba en la lista de las ocho de `/habitos`, pero se monta ahí
  —y también en la portada—, así que dejarla oscura habría dejado una tarjeta
  negra en mitad de una pantalla de papel. El criterio de aceptación pide
  `/habitos` completa, y una sola tarjeta fuera del idioma se ve desde la otra
  punta de la habitación.

  Que la portada reciba el cambio ya estaba asumido: sus `Stat` y sus `Card`
  son pastel desde que se repintaron los seis componentes base.

  Deja de dibujar su propia superficie y pasa a usar `<Card>` con su rótulo, que
  es exactamente lo que hacía a mano con `.m-card` y `.m-label`.
*/
export function QuestList({ quests }: { quests: DailyQuestRow[] }) {
  if (quests.length === 0) return null;
  const done = quests.filter((q) => q.completed).length;

  const cifra = {
    fontFamily: "var(--font-vt)",
    fontSize: 16,
    lineHeight: 1,
    fontVariantNumeric: "tabular-nums" as const,
  };

  return (
    <Card title="Objetivos del día" action={<span style={cifra}>{done}/{quests.length}</span>}>
      {quests.map((q) => {
        const def = QUEST_DEFS[q.kind];
        const ratio = q.completed ? 1 : Math.min(1, q.progress / q.target);
        return (
          <div key={q.id} style={{ marginBottom: 12 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 10,
                fontSize: 12.5,
                marginBottom: 6,
              }}
            >
              {/* Lo cumplido se tacha en vez de apagarse de color: sobre papel,
                  bajar el tono se come el contraste, y el tachado además se ve
                  sin distinguir tonos. */}
              <span style={{ textDecoration: q.completed ? "line-through" : "none" }}>
                {def.description}
              </span>
              <span style={cifra}>
                {q.completed ? `+${q.xpReward} XP` : `${q.progress}/${q.target}`}
              </span>
            </div>
            <ProgressBar
              value={ratio}
              height={10}
              fill={q.completed ? "var(--color-tinta)" : "var(--color-sky)"}
            />
          </div>
        );
      })}
    </Card>
  );
}
