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
        {/*
          El color se hereda, no se fija. Es lo que permite que la cabecera
          funcione en las dos pieles mientras dure la transición: sobre papel
          hereda tinta de la página, y dentro de un `.m-root` hereda la tinta
          clara del lenguaje oscuro.

          Fijarlo en tinta dejó los títulos de tareas, proyectos y jardín a
          1,84:1 sobre su fondo oscuro, que es ilegible. Un componente
          compartido no puede dar por hecho el fondo sobre el que cae.
        */}
        <h1
          style={{
            fontFamily: "var(--font-pixel)",
            fontSize: 16,
            lineHeight: 1.5,
            overflowWrap: "anywhere",
          }}
        >
          {title}
        </h1>
        {subtitle ? (
          <p style={{ fontSize: 13.5, marginTop: 8 }}>{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
