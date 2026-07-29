import type { CSSProperties, ReactNode } from "react";

/**
 * La superficie del sistema pixel: papel, trazo de 3px y sombra dura.
 *
 * Ya no se apoya en la clase global `.m-card`. No es un descuido: esa clase la
 * usan directamente ocho pantallas que este paso no repinta (tareas, proyectos
 * y la portada), y repintarla las habría arrastrado a todas. Se queda oscura
 * para ellas; `<Card>` trae lo suyo.
 *
 * `color` y `fontFamily` van aquí a propósito. Dentro de `.m-root` se hereda
 * tinta casi blanca y system-ui, que sobre papel crema serían texto invisible
 * en la fuente equivocada. La tarjeta corta esa herencia en su borde.
 */
const SUPERFICIE: CSSProperties = {
  background: "var(--color-paper)",
  border: "3px solid var(--color-line)",
  borderRadius: "var(--radius-card)",
  boxShadow: "var(--shadow-hard)",
  padding: 18,
  color: "var(--color-tinta)",
  fontFamily: "var(--font-cuerpo)",
};

/**
 * El rótulo va en VT323, que es la fuente de etiquetas y datos, a 16px — su
 * mínimo legible. En tinta y no en tinta-2: a este tamaño tinta-2 se queda en
 * 4,00:1, que solo vale para texto grande.
 */
const ROTULO: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontFamily: "var(--font-vt)",
  fontSize: 16,
  lineHeight: 1,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--color-tinta)",
};

/**
 * Un cuadrado de rosa delante del rótulo.
 *
 * Es lo único decorativo del componente y está aquí a propósito: un cuadrado
 * sin radio es la forma más pixel que existe, y sitúa el acento de la marca en
 * cada tarjeta del dashboard sin robarle sitio al contenido.
 *
 * Va `aria-hidden` porque no dice nada: el rótulo ya está escrito al lado.
 */
const MARCA: CSSProperties = {
  width: 10,
  height: 10,
  flexShrink: 0,
  background: "var(--color-pink)",
  border: "2px solid var(--color-line)",
};

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
    <div className={className} style={{ ...SUPERFICIE, ...style }}>
      {hasHeader ? (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginBottom: 14,
          }}
        >
          {title !== undefined ? (
            <span style={ROTULO}>
              <span aria-hidden style={MARCA} />
              {title}
            </span>
          ) : (
            <span />
          )}
          {action}
        </div>
      ) : null}
      {children}
    </div>
  );
}
