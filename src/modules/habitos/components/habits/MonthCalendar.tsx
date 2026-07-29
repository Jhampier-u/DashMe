"use client";

import { useEffect, useState, useTransition } from "react";
import type { MonthDay } from "@/modules/habitos/lib/habits";
import { fetchHabitMonth, toggleHabitOnDay } from "@/modules/habitos/actions";
import { emitToggleResult } from "@/modules/habitos/lib/events";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const WEEKDAYS = ["D", "L", "M", "M", "J", "V", "S"];

const NAV_BUTTON =
  "w-[28px] h-[28px] inline-flex items-center justify-center " +
  "rounded-control border-3 border-line bg-paper text-tinta text-xs leading-none " +
  "cursor-pointer shadow-hard font-cuerpo " +
  "transition-[transform,box-shadow] duration-75 ease-out " +
  "active:translate-x-0.5 active:translate-y-0.5 " +
  "active:shadow-[2px_2px_0_var(--color-line)] " +
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-line";

export function MonthCalendar({
  habitId,
  habitName,
}: {
  habitId: string;
  habitName: string;
}) {
  const [now] = useState(() => new Date());
  const [year, setYear] = useState(() => now.getFullYear());
  const [month, setMonth] = useState(() => now.getMonth());
  // El mes cargado viaja con sus datos, así que "cargando" es un valor derivado.
  const [loaded, setLoaded] = useState<{ key: string; days: MonthDay[] } | null>(null);
  const [token, setToken] = useState(0);
  const [pending, startTransition] = useTransition();

  const monthKey = `${year}-${month}`;
  const loading = loaded?.key !== monthKey;
  const days = loaded?.key === monthKey ? loaded.days : [];

  useEffect(() => {
    let alive = true;
    fetchHabitMonth(habitId, year, month).then((result) => {
      if (alive) setLoaded({ key: `${year}-${month}`, days: result });
    });
    return () => {
      alive = false;
    };
  }, [habitId, year, month, token]);

  function shift(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setMonth(m);
    setYear(y);
  }

  function toggle(day: MonthDay) {
    if (!day.editable || pending) return;
    setLoaded((prev) =>
      prev === null
        ? prev
        : {
            ...prev,
            days: prev.days.map((d) =>
              d.date === day.date ? { ...d, done: !d.done } : d,
            ),
          },
    );
    startTransition(async () => {
      emitToggleResult(await toggleHabitOnDay(habitId, day.date));
      setToken((t) => t + 1);
    });
  }

  function describe(day: MonthDay): string {
    if (day.shielded) return `${day.date}: cubierto por un escudo`;
    if (day.isFuture) return `${day.date}: aún no llega`;
    if (!day.scheduled) return `${day.date}: no toca`;
    if (!day.editable) return `${day.date}: fuera del rango editable`;
    return `${day.date}: ${day.done ? "cumplido" : "pendiente"}`;
  }

  /*
    Seis estados en celdas de treinta y pocos píxeles es el sitio donde el
    contraste se rompe, así que ninguno se fía solo del tono:

      escudado    fondo rosa      + el glifo 🛡, que ya lo distingue por forma
      mínimo      fondo amarillo + número en tinta
      hecho       fondo tinta    + número en papel, invertido
      pendiente   fondo paper-2  + trazo CONTINUO
      no toca     sin fondo      + trazo DISCONTINUO

    Los dos últimos son los que más se parecerían —papel claro sobre papel
    claro—, y por eso lo que los separa es el trazo y no el relleno. Bajo
    daltonismo, o en una pantalla mala, la línea sigue ahí.

    Ninguna combinación baja de AA: tinta sobre rosa 5,43:1, sobre amarillo
    8,49:1, sobre paper-2 9,09:1, y papel sobre tinta 9,76:1.
  */
  function colors(day: MonthDay) {
    if (day.shielded) {
      return { bg: "var(--color-pink)", fg: "var(--color-tinta)", dashed: false };
    }
    if (day.partial) {
      return { bg: "var(--color-yellow)", fg: "var(--color-tinta)", dashed: false };
    }
    if (day.done) {
      return { bg: "var(--color-tinta)", fg: "var(--color-paper)", dashed: false };
    }
    if (!day.scheduled) {
      return { bg: "transparent", fg: "var(--color-tinta)", dashed: true };
    }
    return { bg: "var(--color-paper-2)", fg: "var(--color-tinta)", dashed: false };
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <button type="button" onClick={() => shift(-1)} className={NAV_BUTTON} aria-label="Mes anterior">
          ←
        </button>
        <span
          style={{
            fontFamily: "var(--font-vt)",
            fontSize: 20,
            lineHeight: 1,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: "var(--color-tinta)",
          }}
        >
          {MONTHS[month]} {year}
        </span>
        <button type="button" onClick={() => shift(1)} className={NAV_BUTTON} aria-label="Mes siguiente">
          →
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
        {/* Las cabeceras van en Quicksand y no en VT323: a este tamaño la
            pixelada quedaría por debajo de sus 16px y dejaría de leerse. */}
        {WEEKDAYS.map((w, i) => (
          <div
            key={i}
            style={{
              textAlign: "center",
              fontFamily: "var(--font-cuerpo)",
              fontSize: 11,
              fontWeight: 700,
              color: "var(--color-tinta)",
              paddingBottom: 2,
            }}
          >
            {w}
          </div>
        ))}

        {loading
          ? Array.from({ length: 35 }).map((_, i) => (
              <div
                key={i}
                style={{
                  aspectRatio: "1",
                  borderRadius: 6,
                  background: "var(--color-paper-2)",
                  border: "2px dashed var(--color-line)",
                }}
              />
            ))
          : days.map((day) => {
              const { bg, fg, dashed } = colors(day);
              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => toggle(day)}
                  disabled={!day.editable || pending}
                  title={describe(day)}
                  aria-label={`${habitName}, ${describe(day)}`}
                  style={{
                    aspectRatio: "1",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 6,
                    // VT323 en su suelo: 16px. La celda se dimensiona sola con
                    // `aspectRatio`, así que manda la fuente sobre la celda.
                    fontFamily: "var(--font-vt)",
                    fontSize: 16,
                    lineHeight: 1,
                    fontVariantNumeric: "tabular-nums",
                    background: bg,
                    color: fg,
                    border: `2px ${dashed ? "dashed" : "solid"} var(--color-line)`,
                    // Hoy se marca por fuera, con un cerco separado del borde.
                    // Teñir el propio borde lo habría hecho competir con la
                    // distinción continuo/discontinuo, que aquí vale más.
                    outline: day.isToday ? "2px solid var(--color-line)" : undefined,
                    outlineOffset: day.isToday ? 2 : undefined,
                    opacity: day.inMonth ? (day.isFuture ? 0.45 : 1) : 0.3,
                    cursor: day.editable ? "pointer" : "default",
                  }}
                >
                  {day.shielded ? "🛡" : day.day}
                </button>
              );
            })}
      </div>

      {/* La leyenda sigue al dibujo: decía «tono suave» y ya no hay tono
          suave. Ahora nombra también la distinción por trazo. */}
      <div
        style={{
          fontSize: 11,
          color: "var(--color-tinta)",
          marginTop: 10,
          fontFamily: "var(--font-cuerpo)",
        }}
      >
        Solo los días que tocan, hasta 60 días atrás. 🛡 escudo · amarillo, modo
        mínimo · trazo discontinuo, no toca.
      </div>
    </div>
  );
}
