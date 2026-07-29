import { Card } from "@/modules/core/ui/Card";
import { ProgressBar } from "@/modules/core/ui/ProgressBar";
import { weekdayFullName, weekdayName } from "@/modules/habitos/lib/stats";
import type { HabitDiagnosis } from "@/modules/habitos/lib/habits";

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function pct(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`;
}

/**
 * Los porcentajes son datos, así que van en VT323 y en su suelo de 16px.
 * Ninguno depende del color para leerse: la cifra está siempre escrita.
 */
const CIFRA = {
  fontFamily: "var(--font-vt)",
  fontSize: 16,
  lineHeight: 1,
  fontVariantNumeric: "tabular-nums",
  color: "var(--color-tinta)",
} as const;

// La pista se fue a `ProgressBar`: estaba escrita cuatro veces.

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
          <p style={{ fontSize: 12.5 }}>
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
                  <span>
                    {habit.icon} {habit.name}
                  </span>
                  <span style={CIFRA}>{pct(habit.rate)}</span>
                </div>
                {/*
                  Peach por debajo de la mitad, rosa por encima. El color es
                  refuerzo, no información: el porcentaje va escrito justo
                  encima, así que quien no distinga los dos tonos lo tiene igual
                  de claro.
                */}
                <ProgressBar
                  value={habit.rate ?? 0}
                  fill={(habit.rate ?? 0) < 0.5 ? "var(--color-peach)" : "var(--color-pink)"}
                />
              </div>
            ))}
            <p style={{ fontSize: 11, marginTop: 2 }}>
              Cada uno sobre los días que le tocaban, en las últimas cuatro semanas.
            </p>
          </div>
        )}
      </Card>

      <Card title="Qué día se te cae">
        {worst === null ? (
          <p style={{ fontSize: 12.5 }}>Aún no hay historial suficiente.</p>
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
                      {/* El peor día se marca con relleno peach Y con la
                          etiqueta en negrita. La etiqueta no puede ir teñida:
                          el pastel es fondo, nunca texto. */}
                      <div
                        style={{
                          width: "100%",
                          height: rate === null ? 0 : `${Math.max(4, rate * 100)}%`,
                          background: esPeor ? "var(--color-peach)" : "var(--color-pink)",
                          border: rate === null ? "none" : "2px solid var(--color-line)",
                          borderBottom: "none",
                          borderRadius: "6px 6px 0 0",
                        }}
                      />
                    </div>
                    <div
                      style={{
                        fontSize: 10.5,
                        fontWeight: esPeor ? 700 : 400,
                        color: "var(--color-tinta)",
                      }}
                    >
                      {weekdayName(weekday)}
                    </div>
                  </div>
                );
              })}
            </div>
            <p style={{ fontSize: 12.5 }}>
              Tu peor día es el <strong>{weekdayFullName(worst.weekday)}</strong>, con un{" "}
              {pct(worst.rate)} de cumplimiento.
            </p>
          </>
        )}
      </Card>

      <Card title="Lo que llevas más sin tocar">
        {masAbandonado === undefined ? (
          <p style={{ fontSize: 12.5 }}>Sin hábitos.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {untouched.map((habit, i) => (
              <div
                key={habit.id}
                style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}
              >
                {/* El primero es el más abandonado. Antes se marcaba tiñendo
                    el número; ahora con el grosor, que es lo único que queda
                    cuando el color de texto está reservado a la tinta. */}
                <span style={{ fontWeight: i === 0 ? 700 : 400 }}>{habit.name}</span>
                <span style={{ ...CIFRA, fontWeight: i === 0 ? 700 : 400 }}>
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
            <p style={{ fontSize: 11, marginTop: 2 }}>
              No es la racha: uno de lunes y viernes puede tenerla viva y llevar cinco
              días sin tocarse.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
