/**
 * Carril y relleno. Estaba escrito cuatro veces con la misma forma: en el panel
 * de diagnóstico, en los objetivos del día, en la tarjeta de proyecto y en el
 * detalle de proyecto.
 *
 * El carril lleva trazo propio: sin él, una barra al 4% sobre papel sería un
 * punto perdido en el aire. El relleno va en pastel porque es superficie, que
 * es justo el papel que la regla dura le reserva.
 */
export function ProgressBar({
  /** De 0 a 1. Se acota, así que un valor fuera de rango no rompe el dibujo. */
  value,
  /** Color del relleno. Pastel o tinta, nunca un tono pensado para texto. */
  fill = "var(--color-pink)",
  height = 12,
  label,
}: {
  value: number;
  fill?: string;
  height?: number;
  /** Qué mide. Sin esto la barra es decoración y se anuncia como tal. */
  label?: string;
}) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);

  /*
    Era un `div` sin rol: para un lector de pantalla la barra no existía. Ahora
    es un `progressbar` de verdad cuando se le da un `label`, y decoración
    declarada cuando no —que es lo correcto donde el número ya está escrito al
    lado, para no anunciarlo dos veces—.
  */
  return (
    <div
      role={label ? "progressbar" : undefined}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      aria-valuenow={label ? percent : undefined}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? 100 : undefined}
      style={{
        height,
        background: "var(--color-paper-2)",
        border: "2px solid var(--color-line)",
        borderRadius: 999,
        overflow: "hidden",
      }}
    >
      <div style={{ height: "100%", width: `${percent}%`, background: fill }} />
    </div>
  );
}
