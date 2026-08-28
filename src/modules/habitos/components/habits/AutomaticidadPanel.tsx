"use client";

import { useState, useTransition } from "react";
import { guardarAutomaticidad } from "@/modules/habitos/actions";
import {
  ANCLAS,
  ITEMS,
  MEDIDAS_MINIMAS,
  type Sugerencia,
} from "@/modules/habitos/lib/srbai";

const VALORES = [1, 2, 3, 4, 5, 6, 7];

/*
  Cuatro preguntas, una vez por semana.

  Va debajo del hábito y CERRADO: es una medida, no una tarea pendiente. Si se
  abriera solo, cada semana el dashboard tendría cuatro preguntas esperándote
  por hábito, que es exactamente la clase de deuda que hace abandonar una app.
*/
export function AutomaticidadPanel({
  habitId,
  nombre,
  sugerencia,
  tocaPreguntar,
  medidas,
  onInteriorizar,
}: {
  habitId: string;
  nombre: string;
  sugerencia: Sugerencia;
  tocaPreguntar: boolean;
  medidas: number;
  onInteriorizar: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [r, setR] = useState<(number | null)[]>([null, null, null, null]);
  const [pending, startTransition] = useTransition();

  const completo = r.every((x) => x !== null);

  function enviar() {
    if (!completo) return;
    startTransition(async () => {
      await guardarAutomaticidad(habitId, r as [number, number, number, number]);
      setAbierto(false);
      setR([null, null, null, null]);
    });
  }

  return (
    <div style={{ marginTop: 8, fontSize: 12 }}>
      {sugerencia.tipo === "sugerir" ? (
        /*
          El aviso. Sin color y sin celebración: es una lectura, no un trofeo.

          Dice el número y de cuántas semanas sale, porque una sugerencia sin
          su base es una corazonada con tipografía. Y dice que decides tú: la
          escala NO tiene punto de corte validado, así que esto es una señal
          para que la mires, nunca un veredicto.
        */
        <div
          style={{
            border: "3px solid var(--color-line)",
            borderRadius: "var(--radius-control)",
            background: "var(--color-paper-2)",
            padding: 10,
            marginBottom: 8,
          }}
        >
          <div style={{ fontWeight: 700 }}>
            Tu automaticidad lleva semanas sin moverse, y arriba.
          </div>
          <p style={{ marginTop: 4 }}>
            Media de{" "}
            <b style={{ fontFamily: "var(--font-vt)", fontSize: 15 }}>
              {sugerencia.media.toFixed(1)}
            </b>{" "}
            sobre 7 en las últimas semanas, con {sugerencia.semanas} medidas.
            Quizá ya no necesites que te lo pidan.
          </p>
          <button
            type="button"
            onClick={onInteriorizar}
            className="underline bg-transparent border-0 p-0 mt-1 font-cuerpo text-[12px] text-tinta cursor-pointer"
          >
            Dar «{nombre}» por hecho
          </button>
        </div>
      ) : null}

      {!tocaPreguntar ? null : !abierto ? (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="underline bg-transparent border-0 p-0 font-cuerpo text-[11.5px] text-tinta cursor-pointer"
        >
          Medir automaticidad de esta semana
        </button>
      ) : (
        <div
          style={{
            border: "3px solid var(--color-line)",
            borderRadius: "var(--radius-control)",
            padding: 10,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <p style={{ margin: 0 }}>
            <b>{nombre}</b> — hasta qué punto estás de acuerdo, esta semana:
          </p>

          {ITEMS.map((item, i) => (
            <fieldset
              key={item}
              style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
            >
              {/* Un fieldset por ítem: sin él, un lector de pantalla anuncia
                  siete botones sueltos sin decir de qué pregunta son. */}
              <legend style={{ padding: 0, marginBottom: 4 }}>{item}</legend>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {VALORES.map((v) => (
                  <label
                    key={v}
                    className={
                      "w-[34px] h-[30px] inline-flex items-center justify-center " +
                      "rounded-control border-3 border-line bg-paper cursor-pointer " +
                      "font-vt text-[15px] leading-none " +
                      "has-[:checked]:bg-pink " +
                      "has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 " +
                      "has-[:focus-visible]:outline-line"
                    }
                  >
                    <input
                      type="radio"
                      name={`${habitId}-${i}`}
                      value={v}
                      checked={r[i] === v}
                      onChange={() =>
                        setR((prev) => prev.map((x, j) => (j === i ? v : x)))
                      }
                      className="sr-only"
                    />
                    {v}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}

          {/* Solo los extremos y el centro llevan palabra: nombrar los siete
              obligaría a inventarse cuatro matices que la escala no define. */}
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>1 · {ANCLAS[1]}</span>
            <span>4 · {ANCLAS[4]}</span>
            <span>7 · {ANCLAS[7]}</span>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={enviar}
              disabled={!completo || pending}
              className={
                "px-3 py-1 rounded-control border-3 border-line bg-pink text-tinta " +
                "font-cuerpo text-[12px] cursor-pointer shadow-hard disabled:opacity-40 " +
                "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-line"
              }
            >
              {pending ? "Guardando…" : "Guardar"}
            </button>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              disabled={pending}
              className="underline bg-transparent border-0 p-0 font-cuerpo text-[12px] text-tinta cursor-pointer"
            >
              Ahora no
            </button>
          </div>

          {medidas < MEDIDAS_MINIMAS ? (
            <p style={{ margin: 0 }}>
              Llevas {medidas} de {MEDIDAS_MINIMAS} medidas. Con menos no hay
              curva que mirar, solo puntos sueltos.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
