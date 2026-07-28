import { Card } from "@/components/ui/Card";
import { weekdayFullName, weekdayName } from "@/lib/stats";
import type { HabitDiagnosis } from "@/lib/habits";

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function pct(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`;
}

export function DiagnosisPanel({ diagnosis }: { diagnosis: HabitDiagnosis }) {
  const { ranking, weekdays, worst, untouched } = diagnosis;
  const conDatos = ranking.filter((h) => h.rate !== null);
  const masAbandonado = untouched[0];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: 12,
        alignItems: "start",
      }}
    >
      <Card title="Qué se te está cayendo">
        {conDatos.length === 0 ? (
          <p style={{ fontSize: 12.5, color: "var(--m-ink-2)" }}>
            Aún no hay días medidos en las últimas cuatro semanas.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {conDatos.map((habit) => (
              <div key={habit.id}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12.5,
                    marginBottom: 5,
                  }}
                >
                  <span style={{ color: "var(--m-ink)" }}>
                    {habit.icon} {habit.name}
                  </span>
                  <span className="m-num" style={{ color: "var(--m-ink-2)" }}>
                    {pct(habit.rate)}
                  </span>
                </div>
                <div style={{ height: 5, background: "var(--m-track)", borderRadius: 3 }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.round((habit.rate ?? 0) * 100)}%`,
                      background:
                        (habit.rate ?? 0) < 0.5 ? "var(--m-crit)" : "var(--m-series)",
                      borderRadius: 3,
                    }}
                  />
                </div>
              </div>
            ))}
            <p style={{ fontSize: 11, color: "var(--m-ink-3)", marginTop: 2 }}>
              Cada uno sobre los días que le tocaban, en las últimas cuatro semanas.
            </p>
          </div>
        )}
      </Card>

      <Card title="Qué día se te cae">
        {worst === null ? (
          <p style={{ fontSize: 12.5, color: "var(--m-ink-2)" }}>
            Aún no hay historial suficiente.
          </p>
        ) : (
          <>
            <div style={{ display: "flex", gap: 5, marginBottom: 12 }}>
              {WEEKDAY_ORDER.map((weekday) => {
                const rate = weekdays[weekday];
                const esPeor = weekday === worst.weekday;
                return (
                  <div key={weekday} style={{ flex: 1, textAlign: "center" }}>
                    <div
                      title={`${weekdayName(weekday)}: ${pct(rate)}`}
                      style={{
                        height: 54,
                        display: "flex",
                        alignItems: "flex-end",
                        marginBottom: 5,
                      }}
                    >
                      <div
                        style={{
                          width: "100%",
                          height: rate === null ? 0 : `${Math.max(3, rate * 100)}%`,
                          background: esPeor ? "var(--m-crit)" : "rgba(57,135,229,0.55)",
                          borderRadius: "3px 3px 0 0",
                        }}
                      />
                    </div>
                    <div
                      style={{
                        fontSize: 10.5,
                        color: esPeor ? "var(--m-crit)" : "var(--m-ink-3)",
                      }}
                    >
                      {weekdayName(weekday)}
                    </div>
                  </div>
                );
              })}
            </div>
            <p style={{ fontSize: 12.5, color: "var(--m-ink-2)" }}>
              Tu peor día es el <strong>{weekdayFullName(worst.weekday)}</strong>, con un{" "}
              {pct(worst.rate)} de cumplimiento.
            </p>
          </>
        )}
      </Card>

      <Card title="Lo que llevas más sin tocar">
        {masAbandonado === undefined ? (
          <p style={{ fontSize: 12.5, color: "var(--m-ink-2)" }}>Sin hábitos.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {untouched.map((habit, i) => (
              <div
                key={habit.id}
                style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}
              >
                <span style={{ color: i === 0 ? "var(--m-ink)" : "var(--m-ink-2)" }}>
                  {habit.name}
                </span>
                <span
                  className="m-num"
                  style={{ color: i === 0 ? "var(--m-warn)" : "var(--m-ink-3)" }}
                >
                  {habit.from === "creation"
                    ? "sin cumplir"
                    : habit.days === 0
                      ? "hoy"
                      : habit.days === 1
                        ? "1 día"
                        : `${habit.days} días`}
                </span>
              </div>
            ))}
            <p style={{ fontSize: 11, color: "var(--m-ink-3)", marginTop: 2 }}>
              No es la racha: uno de lunes y viernes puede tenerla viva y llevar cinco
              días sin tocarse.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
