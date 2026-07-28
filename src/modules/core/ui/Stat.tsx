import type { ReactNode } from "react";
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

export function Stat({ label, value, meta, size = "md" }: StatProps) {
  const md = size === "md";

  const body = (
    <>
      <div className="m-label">{label}</div>
      <div
        className="m-num"
        style={{
          fontSize: md ? 21 : 17,
          fontWeight: 600,
          marginTop: md ? 6 : 4,
          letterSpacing: md ? "-0.02em" : undefined,
        }}
      >
        {value}
      </div>
      {meta === undefined ? null : (
        <div
          style={{
            fontSize: md ? 11.5 : 11,
            color: md ? "var(--m-ink-2)" : "var(--m-ink-3)",
            marginTop: md ? 3 : 2,
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
