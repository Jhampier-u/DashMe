import Link from "next/link";
import { Card } from "@/modules/core/ui/Card";
import { PageHeader } from "@/modules/core/ui/PageHeader";
import { buttonStyle } from "@/modules/core/ui/Button";
import { Stat, StatGrid } from "@/modules/core/ui/Stat";
import { MemoriaDelJardin } from "@/modules/habitos/components/MemoriaDelJardin";
import { Sprite } from "@/modules/core/ui/pixel/Sprite";
import { spriteDe } from "@/modules/habitos/lib/sprites";
import { db } from "@/modules/core/db";
import {
  climaDe,
  dayKey,
  isoFromDayKey,
  getDiasCumplidos,
  getJardinHistorico,
  getHabitsWithTodayStatus,
  isPlantWilted,
  stageFor,
} from "@/modules/habitos";

export const dynamic = "force-dynamic";

/*
  La leyenda dibuja las MISMAS etapas que el jardín, tomando la flor como
  ejemplo. Con emoji decía que «Joven» era 🌿 mientras la planta pintaba otra
  cosa: una leyenda que no coincide con lo que explica es peor que ninguna.
*/
const STAGES = [
  { label: "Semilla", days: "0 d" },
  { label: "Brote", days: "1-2 d" },
  { label: "Joven", days: "3-6 d" },
  { label: "Madura", days: "7-13 d" },
  { label: "Floreciente", days: "14 d o más" },
];

export default async function GardenPage() {
  /*
    El tiempo del jardín sale de la MISMA fuente que la racha global y el cruce
    con música: `getDiasCumplidos`, que ya respeta las pausas. Una semana de
    vacaciones llega como cero y cero, no como una semana de fallos.
  */
  const hoy = new Date();
  const hace7 = new Date(hoy);
  hace7.setUTCDate(hace7.getUTCDate() - 6);

  const [habits, dias, historia] = await Promise.all([
    getHabitsWithTodayStatus(db),
    getDiasCumplidos(db, hace7, hoy),
    getJardinHistorico(db),
  ]);
  const tiempo = climaDe(dias.cumplidos.size, dias.fallados.size);

  const total = habits.length;
  const wateredToday = habits.filter((h) => h.doneToday).length;
  const mature = habits.filter((h) => stageFor(h.streak) >= 3).length;
  const blooming = habits.filter((h) => stageFor(h.streak) >= 4).length;
  const wilted = habits.filter((h) =>
    isPlantWilted(h.streak, h.doneToday, h.hasEverBeenDone),
  ).length;

  // Le llegó su turno, así que el escudo `.m-root` se retira: la pantalla pone
  // ya su propio papel.
  return (
    <main
      style={{
        minHeight: "100%",
        padding: "24px 16px 56px",
        background: "var(--color-paper)",
        color: "var(--color-tinta)",
        fontFamily: "var(--font-cuerpo)",
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      <PageHeader
        title="Tu jardín"
        subtitle="Cada hábito es una planta. Riégalas para que crezcan."
      />

      {total === 0 ? (
        <Card>
          <div style={{ textAlign: "center", padding: "36px 0" }}>
            <div style={{ fontSize: 56, marginBottom: 12 }} aria-hidden>
              🌱
            </div>
            <p style={{ fontSize: 15, marginBottom: 6 }}>
              Tu jardín está esperando su primera semilla.
            </p>
            <p style={{ fontSize: 13, marginBottom: 20 }}>
              Crea un hábito para plantar y empezar a regar.
            </p>
            <Link href="/habitos" style={buttonStyle("primary")}>
              Ir a hábitos
            </Link>
          </div>
        </Card>
      ) : (
        <>
          <StatGrid>
            <Stat label="Plantas" value={String(total)} meta="en el jardín" />
            <Stat
              label="Regadas hoy"
              value={`${wateredToday} / ${total}`}
              meta={wateredToday === total ? "el jardín está al día" : "aún queda riego"}
            />
            <Stat label="Maduras" value={String(mature)} meta="racha de 7 días o más" />
            <Stat label="Florecientes" value={String(blooming)} meta="racha de 14 días o más" />
          </StatGrid>

          {wilted > 0 ? (
            <Card>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span style={{ lineHeight: 1 }} aria-hidden>
                  <Sprite grid={spriteDe("flower", 0, true)} size={34} label="" />
                </span>
                <div>
                  {/* Iba en rojo. Lo que avisa ahora son la planta caída de al
                      lado y el grosor: el aviso no puede depender del tono. */}
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>
                    {wilted === 1 ? "Una planta marchita" : `${wilted} plantas marchitas`}
                  </div>
                  <p style={{ fontSize: 12.5, marginTop: 4 }}>
                    {wilted === 1
                      ? "Riégala hoy, desde aquí o desde Hábitos, y revive."
                      : "Riégalas hoy, desde aquí o desde Hábitos, y revivirán."}
                  </p>
                </div>
              </div>
            </Card>
          ) : null}

          <Card>
            <MemoriaDelJardin
              habitsHoy={habits}
              tiempoHoy={tiempo}
              historia={historia}
              hoyISO={isoFromDayKey(dayKey(hoy))}
            />
            <p style={{ fontSize: 12, marginTop: 10 }}>
              Click en una planta para regarla. La corona marca el hábito ancla y el
              destello, una racha de 7 días o más.
            </p>
            {/* Las dos rutas se explican juntas porque son la misma función: el
                teclado no es un apaño de repuesto. */}
            <p style={{ fontSize: 12, marginTop: 6 }}>
              Para cambiarlas de sitio, arrastra el asa <b>⠿</b> de la esquina, o
              enfócala y pulsa <b>Enter</b>: muévela con las flechas, <b>Enter</b>{" "}
              para dejarla ahí y <b>Escape</b> para devolverla donde estaba.
            </p>
          </Card>

          <Card title="Etapas de crecimiento">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))",
                gap: 10,
              }}
            >
              {STAGES.map((s, i) => (
                <div key={s.label} style={{ textAlign: "center" }}>
                  <div
                    style={{ display: "flex", justifyContent: "center" }}
                    aria-hidden
                  >
                    <Sprite grid={spriteDe("flower", i, false)} size={34} label="" />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>
                    {s.label}
                  </div>
                  {/* Los días son un dato: VT323 en su suelo de 16px. */}
                  <div
                    style={{
                      fontFamily: "var(--font-vt)",
                      fontSize: 16,
                      lineHeight: 1.1,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {s.days}
                  </div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 12, marginTop: 12 }}>
              Mantén la racha y la planta crece. Si la rompes se marchita, pero revive
              en cuanto retomes el hábito.
            </p>
          </Card>
        </>
      )}
    </main>
  );
}
