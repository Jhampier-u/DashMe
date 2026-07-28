import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  /** Acción principal de la pantalla, alineada a la derecha. */
  action?: ReactNode;
};

/**
 * La cabecera de pantalla es el único sitio donde Press Start 2P manda, que es
 * exactamente su papel: títulos de sección y poco más.
 *
 * 16px, dos por encima del mínimo de 14. Los cuatro títulos que existen hoy
 * —Hábitos, Tareas, Proyectos, Tu jardín— caben de sobra. Si algún día uno no
 * cabe, se acorta el texto: la fuente no baja de 14px porque por debajo deja de
 * leerse, y eso no es una opinión estética.
 *
 * `overflowWrap` está para que uno largo parta de línea en vez de desbordar.
 * Partir es feo; desbordar es un error.
 */
export function PageHeader({ title, subtitle, action }: Props) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 16,
        marginBottom: 4,
        fontFamily: "var(--font-cuerpo)",
      }}
    >
      <div>
        <h1
          style={{
            fontFamily: "var(--font-pixel)",
            fontSize: 16,
            lineHeight: 1.5,
            color: "var(--color-tinta)",
            overflowWrap: "anywhere",
          }}
        >
          {title}
        </h1>
        {subtitle ? (
          <p
            style={{
              fontSize: 13.5,
              color: "var(--color-tinta)",
              marginTop: 8,
            }}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
