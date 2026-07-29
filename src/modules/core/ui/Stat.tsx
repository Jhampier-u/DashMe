import type { CSSProperties, ReactNode } from "react";
import { Card } from "./Card";

/**
 * `md` va dentro de su propia tarjeta y es lo que usan las rejillas de
 * métricas de una pantalla. `sm` no lleva tarjeta porque ya vive dentro de
 * una, como en el detalle de un hábito.
 */
export type StatSize = "sm" | "md";

type StatProps = {
  label: string;
  value: string;
  meta?: string;
  size?: StatSize;
};

/**
 * La etiqueta en Quicksand, el número en VT323: es el reparto de fuentes del
 * sistema aplicado al caso más pequeño que existe. VT323 es estrecha, así que
 * 26px de VT323 ocupan lo que 21 de una sans — el número gana presencia sin
 * ganar sitio.
 */
const ETIQUETA: CSSProperties = {
  fontFamily: "var(--font-cuerpo)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.09em",
  textTransform: "uppercase",
  color: "var(--color-tinta)",
};

export function Stat({ label, value, meta, size = "md" }: StatProps) {
  const md = size === "md";

  const body = (
    <>
      <div style={ETIQUETA}>{label}</div>
      {/*
        La cifra se subraya con una barra de rosa.

        Es lo que le da vida a las rejillas de métricas, que son media portada y
        casi todo el jardín: sin ella son texto sobre papel y nada más. Va por
        debajo y no detrás para no tocar el contraste — la tinta sigue cayendo
        sobre papel, 9,76:1.

        `inline-block` para que la barra mida lo que mide la cifra y no toda la
        columna: subrayar «1» y subrayar «1.976» no deben ocupar lo mismo.
      */}
      <div style={{ marginTop: md ? 6 : 4 }}>
        <span
          style={{
            // 26 y 20: los dos por encima del mínimo de 16px de VT323.
            display: "inline-block",
            fontFamily: "var(--font-vt)",
            fontSize: md ? 26 : 20,
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
            color: "var(--color-tinta)",
            borderBottom: "4px solid var(--color-pink)",
            paddingBottom: 2,
          }}
        >
          {value}
        </span>
      </div>
      {meta === undefined ? null : (
        <div
          style={{
            // Tinta plena, no tinta-2: a 11px, 4,00:1 no llega a AA. Lo que
            // separa el apunte del número es el tamaño y el grosor, no el tono.
            fontFamily: "var(--font-cuerpo)",
            fontSize: md ? 11.5 : 11,
            color: "var(--color-tinta)",
            marginTop: md ? 4 : 2,
          }}
        >
          {meta}
        </div>
      )}
    </>
  );

  return md ? <Card style={{ padding: "13px 14px" }}>{body}</Card> : <div>{body}</div>;
}

export function StatGrid({
  children,
  min = 150,
  gap = 10,
}: {
  children: ReactNode;
  min?: number;
  gap?: number;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`,
        gap,
      }}
    >
      {children}
    </div>
  );
}
