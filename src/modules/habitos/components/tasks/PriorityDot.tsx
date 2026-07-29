import {
  PRIORIDAD_DEFS,
  prioridadColorVar,
  type Prioridad,
} from "@/modules/habitos/lib/prioridad";

/**
 * El punto de prioridad. Color Y tamaño: dos señales, no una.
 *
 * El borde de 2px en tinta es lo que lo separa del papel; sin él, `mint` a 6px
 * sobre papel casi no se ve. Y el `title` lo dice en palabras, que es la tercera
 * señal y la única que sirve con un lector de pantalla.
 */
export function PriorityDot({ prioridad }: { prioridad: Prioridad }) {
  const { label, punto } = PRIORIDAD_DEFS[prioridad];
  return (
    <span
      title={label}
      aria-label={`Prioridad: ${label}`}
      role="img"
      style={{
        width: punto,
        height: punto,
        borderRadius: 999,
        background: prioridadColorVar(prioridad),
        border: "2px solid var(--color-line)",
        display: "inline-block",
        flexShrink: 0,
        // Alinea el punto con la primera línea del título sea cual sea su
        // tamaño: sin esto, el de 15px empuja el texto hacia abajo.
        marginTop: 2,
      }}
    />
  );
}
