"use client";

import { useState, useTransition } from "react";
import { Sprite } from "@/modules/core/ui/pixel/Sprite";
import { buttonStyle } from "@/modules/core/ui/Button";
import {
  CATALOGO,
  puedeComprar,
  type Decoracion,
} from "@/modules/habitos/lib/decoraciones";
import { comprarDecoracion } from "@/modules/habitos/actions";

/*
  La tienda del jardín.

  Cada decoración es única, así que la lista tiene tres estados por fila: tuya,
  comprable, o te falta saldo. Los tres se dicen CON PALABRAS y no solo con un
  botón apagado o un tono distinto — es la regla de siempre: nunca una sola
  señal.
*/

type Props = { saldo: number; tuyas: Decoracion[] };

export function Tienda({ saldo, tuyas }: Props) {
  const [pendiente, empezar] = useTransition();
  const [comprando, setComprando] = useState<Decoracion | null>(null);
  const [aviso, setAviso] = useState("");

  // El saldo y lo comprado los vuelve a mandar el servidor tras `refresh()`,
  // pero mientras llega se pinta lo que ya sabemos: el botón no puede quedarse
  // ofreciendo algo que se acaba de pagar.
  const optimistas = comprando ? [...tuyas, comprando] : tuyas;
  const gastadoYa = comprando
    ? (CATALOGO.find((d) => d.kind === comprando)?.precio ?? 0)
    : 0;
  const saldoVisible = saldo - gastadoYa;

  function comprar(kind: Decoracion) {
    setComprando(kind);
    setAviso("");
    empezar(async () => {
      const r = await comprarDecoracion(kind);
      /*
        Se limpia SIEMPRE, acierte o falle. Dejándolo puesto tras una compra
        buena, el saldo se restaba dos veces: una la que ya venía descontada del
        servidor y otra la de aquí. La base decía 100 y la pantalla, 50.

        Es seguro porque el `refresh()` de la acción viaja dentro de esta misma
        transición: cuando esto se ejecuta, el servidor ya ha mandado el saldo y
        la decoración nuevos.
      */
      setComprando(null);
      if (!r.ok) {
        setAviso(
          r.razon.motivo === "sin-saldo"
            ? `No se pudo comprar: te faltan ${r.razon.faltan} XP.`
            : r.razon.motivo === "ya-es-tuya"
              ? "Esa decoración ya es tuya."
              : "Esa decoración ya no existe.",
        );
      }
    });
  }

  return (
    <div>
      <p style={{ fontSize: 12.5, marginBottom: 12 }}>
        Tienes{" "}
        <b
          style={{
            fontFamily: "var(--font-vt)",
            fontSize: 17,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {saldoVisible} XP
        </b>{" "}
        para gastar. Comprar no te baja de nivel: el nivel sale de lo que has
        ganado, no de lo que te queda.
      </p>

      <div role="status" aria-live="polite" style={{ fontSize: 12.5 }}>
        {aviso}
      </div>

      <ul
        style={{
          listStyle: "none",
          margin: "8px 0 0",
          padding: 0,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(15rem, 1fr))",
          gap: 10,
        }}
      >
        {CATALOGO.map((d) => {
          const veredicto = puedeComprar(d.kind, saldoVisible, optimistas);
          const esTuya = !veredicto.puede && veredicto.motivo === "ya-es-tuya";
          const faltan =
            !veredicto.puede && veredicto.motivo === "sin-saldo"
              ? veredicto.faltan
              : 0;

          return (
            <li
              key={d.kind}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
                border: "2px solid var(--color-line)",
                borderRadius: "var(--radius-card)",
                padding: 10,
                // Lo que ya es tuyo se apaga un poco, pero lo que lo DICE es el
                // texto de abajo: el tono solo acompaña.
                opacity: esTuya ? 0.75 : 1,
              }}
            >
              <span aria-hidden style={{ flexShrink: 0, lineHeight: 0 }}>
                <Sprite grid={d.grid} size={40} label="" />
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{d.label}</div>
                <p style={{ fontSize: 12, margin: "2px 0 6px" }}>
                  {d.descripcion}
                </p>
                <div
                  style={{
                    fontFamily: "var(--font-vt)",
                    fontSize: 16,
                    lineHeight: 1.1,
                    fontVariantNumeric: "tabular-nums",
                    marginBottom: 6,
                  }}
                >
                  {d.precio} XP
                </div>

                {esTuya ? (
                  <div style={{ fontSize: 12, fontWeight: 700 }}>
                    Ya es tuya · puesta en el jardín
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => comprar(d.kind)}
                      disabled={!veredicto.puede || pendiente}
                      style={buttonStyle(veredicto.puede ? "primary" : "ghost")}
                    >
                      Comprar
                    </button>
                    {faltan > 0 ? (
                      // El número, no solo el botón apagado: sin él hay que
                      // restar de cabeza para saber si faltan diez o seiscientos.
                      <div style={{ fontSize: 12, marginTop: 4 }}>
                        Te faltan{" "}
                        <b
                          style={{
                            fontFamily: "var(--font-vt)",
                            fontSize: 15,
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {faltan} XP
                        </b>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
