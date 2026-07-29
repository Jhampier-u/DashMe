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
}: {
  value: number;
  fill?: string;
  height?: number;
}) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);

  return (
    <div
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
