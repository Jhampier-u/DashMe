import type { CSSProperties, ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Rótulo de la tarjeta. Si falta, la tarjeta es solo superficie. */
  title?: string;
  /** Contenido alineado a la derecha del rótulo. */
  action?: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export function Card({ children, title, action, className, style }: Props) {
  const hasHeader = title !== undefined || action !== undefined;

  return (
    <div className={className ? `m-card ${className}` : "m-card"} style={style}>
      {hasHeader ? (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 12,
            marginBottom: 14,
          }}
        >
          {title !== undefined ? <span className="m-label">{title}</span> : <span />}
          {action}
        </div>
      ) : null}
      {children}
    </div>
  );
}
