import type { ReactNode } from "react";

/*
  La burbuja de detalle de las gráficas. Estaba declarada dos veces, con los
  mismos doce valores, en `LineChart` y en `BarChart`.

  Cerca de los bordes se ancla por su lado en vez de centrarse, para no
  desbordar la tarjeta que la contiene.
*/
export function ChartTooltip({
  /** Posición horizontal en porcentaje del ancho de la gráfica. */
  left,
  children,
}: {
  left: number;
  children: ReactNode;
}) {
  const anchor =
    left < 15
      ? "translateX(0)"
      : left > 85
        ? "translateX(-100%)"
        : "translateX(-50%)";

  return (
    <div
      style={{
        position: "absolute",
        left: `${left}%`,
        top: 0,
        transform: anchor,
        pointerEvents: "none",
        background: "var(--color-paper)",
        border: "3px solid var(--color-line)",
        borderRadius: "var(--radius-control)",
        boxShadow: "var(--shadow-hard)",
        color: "var(--color-tinta)",
        fontFamily: "var(--font-cuerpo)",
        padding: "7px 10px",
        fontSize: 11.5,
        lineHeight: 1.5,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </div>
  );
}
