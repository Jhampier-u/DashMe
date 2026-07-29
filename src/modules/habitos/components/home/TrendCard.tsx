"use client";

import { useState } from "react";
import { Card } from "@/modules/core/ui/Card";
import { ComplianceChart, type ChartPoint } from "@/modules/habitos/components/charts/ComplianceChart";
import type { PeriodDelta } from "@/modules/habitos/lib/metrics";

const RANGES = [
  { key: "28d", label: "28d", days: 28 },
  { key: "90d", label: "90d", days: 90 },
  { key: "12m", label: "12m", days: 365 },
] as const;

type Props = {
  points: ChartPoint[];
  delta: PeriodDelta | null;
};

export function TrendCard({ points, delta }: Props) {
  // Se guarda el rango completo (no solo la clave) para no tener que volver a
  // buscarlo en RANGES con una aserción no nula: el estado inicial ya es un
  // elemento real del array, así que siempre hay un `days` válido a mano.
  const [range, setRange] = useState<(typeof RANGES)[number]>(RANGES[0]);
  const visible = points.slice(-range.days);

  const deltaPoints = delta?.deltaPoints ?? null;
  const changed = deltaPoints !== null && deltaPoints !== 0;
  const up = changed && deltaPoints > 0;

  return (
    // El rótulo y el selector vivían en un `flex` con `space-between` montado a
    // mano. `Card` ya resuelve eso con `title` y `action`.
    <Card
      title="Cumplimiento"
      action={<SelectorDeRango range={range} onChange={setRange} />}
    >
      {delta === null ? (
        <div style={{ fontSize: 13 }}>Aún no hay datos suficientes.</div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
            <span
              style={{
                fontFamily: "var(--font-vt)",
                fontSize: 34,
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {Math.round(delta.current * 100)}%
            </span>
            {delta.deltaPoints === null ? null : (
              // Iba en verde o rojo según subiera o bajara. Ahora lo dicen la
              // flecha y el grosor, que se leen sin distinguir tonos.
              <span style={{ fontSize: 12.5, fontWeight: changed ? 700 : 500 }}>
                {changed ? `${up ? "▲" : "▼"} ${Math.abs(delta.deltaPoints)} pts` : "sin cambio"}
              </span>
            )}
          </div>
          <div style={{ fontSize: 11.5, marginTop: 6 }}>
            {delta.previous === null
              ? "sin periodo anterior suficiente para comparar"
              : `frente a ${Math.round(delta.previous * 100)}% del periodo anterior · ${delta.previousDays} días medidos`}
          </div>
        </>
      )}

      <div style={{ marginTop: 14 }}>
        <ComplianceChart points={visible} />
      </div>
    </Card>
  );
}

/**
 * Lo elegido se marca con la variante `aria-pressed:` de Tailwind, que lee el
 * atributo que ya estaba puesto: así el estado visual y el accesible no pueden
 * separarse. Antes eran dos cosas distintas, y la elegida quedaba a 1,12:1.
 */
function SelectorDeRango({
  range,
  onChange,
}: {
  range: (typeof RANGES)[number];
  onChange: (r: (typeof RANGES)[number]) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {RANGES.map((r) => (
        <button
          key={r.key}
          type="button"
          onClick={() => onChange(r)}
          aria-pressed={range.key === r.key}
          className={
            "px-2.5 py-1 rounded-control border-3 border-line " +
            "bg-paper text-tinta font-cuerpo text-[11.5px] cursor-pointer " +
            "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-line " +
            "aria-pressed:bg-pink aria-pressed:font-bold"
          }
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
