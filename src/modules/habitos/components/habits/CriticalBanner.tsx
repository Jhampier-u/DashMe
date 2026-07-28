import type { HabitWithStatus } from "@/modules/habitos/lib/habits";

/**
 * Regla de los 2 días. El color va siempre acompañado de icono y texto: quien
 * no distingue el rojo debe recibir el mismo aviso.
 *
 * Es lo único de la pantalla cuyo trabajo es alarmar, y en pastel eso se
 * consigue con el relleno y el trazo, nunca bajando la tinta. Antes gritaba con
 * texto rojo sobre un fondo casi transparente; ahora grita al revés: peach
 * macizo, trazo de 3px y sombra dura, con toda la letra en tinta plena
 * (7,64:1). El aviso pesa más y además se lee mejor que antes.
 *
 * Que ya no haya rojo no le quita nada: el rojo nunca fue lo que comunicaba
 * —por eso el icono y el texto estaban ahí desde el principio—, y la paleta
 * pastel no tiene ninguno que aguante como fondo.
 */
export function CriticalBanner({ habits }: { habits: HabitWithStatus[] }) {
  const critical = habits.filter((h) => h.criticalToday);
  if (critical.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        background: "var(--color-peach)",
        border: "3px solid var(--color-line)",
        borderRadius: "var(--radius-card)",
        boxShadow: "var(--shadow-hard)",
        padding: "14px 16px",
        color: "var(--color-tinta)",
        fontFamily: "var(--font-cuerpo)",
      }}
    >
      <span aria-hidden style={{ fontSize: 18, lineHeight: 1.2 }}>
        ▲
      </span>
      <div>
        {/*
          VT323 en versalitas a 18px: es la fuente de etiquetas y datos, y en
          mayúsculas es lo más parecido a un grito que tiene el sistema. Press
          Start 2P queda fuera porque el aviso pasa de cuatro palabras y su
          límite es ese, no un capricho de tamaño.
        */}
        <div
          style={{
            fontFamily: "var(--font-vt)",
            fontSize: 18,
            lineHeight: 1.1,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          {critical.length === 1
            ? "Un hábito viene de fallar"
            : `${critical.length} hábitos vienen de fallar`}
        </div>
        <div style={{ fontSize: 12.5, marginTop: 6 }}>
          Fallar dos veces seguidas es lo que rompe una racha:{" "}
          {critical.map((h) => h.name).join(", ")}.
        </div>
      </div>
    </div>
  );
}
