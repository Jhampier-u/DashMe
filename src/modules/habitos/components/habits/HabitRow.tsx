"use client";

import { useState, useTransition } from "react";
import {
  toggleToday,
  deleteHabit,
  setHabitAnchor,
  apuntarCantidad,
  guardarNota,
  updateHabitIntention,
  marcarInteriorizado,
} from "@/modules/habitos/actions";
import { emitToggleResult } from "@/modules/habitos/lib/events";
import { useConfirm } from "@/modules/habitos/components/ConfirmDialog";
import { habitColorVar, resolveHabitColor } from "@/modules/habitos/lib/color";
import { plantEmoji, type PlantSpecies } from "@/modules/habitos/lib/garden";
import { DEFAULT_SCHEDULE } from "@/modules/habitos/lib/streak";
import { HabitDetail } from "./HabitDetail";

type Props = {
  id: string;
  name: string;
  icon: string;
  color: string;
  streak: number;
  doneToday: boolean;
  rachaPerdonados: number;
  interiorizadoEl: Date | null;
  /** Si hay registro hoy. El botón de marcar lo BORRA, así que decide él. */
  registradoHoy: boolean;
  partialToday: boolean;
  scheduledToday: boolean;
  criticalToday: boolean;
  isAnchor: boolean;
  schedule: string;
  intention: string | null;
  plantSpecies: PlantSpecies;
  hasEverBeenDone: boolean;
  minimalGoal: string | null;
  /** Objetivo numérico del día. Nulo = este hábito no se cuenta. */
  targetCount: number | null;
  /** Lo apuntado hoy. Nulo si no se apuntó. */
  countToday: number | null;
  /** La nota de hoy, si la hay. */
  notaHoy: string | null;
  /** El día de hoy en "YYYY-MM-DD", calculado en el SERVIDOR. */
  hoyISO: string;
  /** Si hoy cae dentro de una pausa. */
  enPausaHoy: boolean;
};

const WEEKDAY_LABELS = ["D", "L", "M", "M", "J", "V", "S"];
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

/*
  Los botones de icono van en clases y no en un objeto de estilo porque llevan
  `:active`, `:focus-visible` y `:disabled`, y nada de eso se puede escribir en
  línea. Se hunden igual que `<Button>`: 2px hacia la sombra y la sombra a 2px.
  Aquí no hace falta el `!` de la sombra porque no hay ninguna en línea a la que
  ganarle.

  Los glifos van todos en tinta. El aviso de cada uno lo da el fondo —que es la
  regla dura del sistema— y, donde importa, el `aria-label`, que no ha cambiado.
*/
const ICON_BUTTON =
  "w-[30px] h-[30px] shrink-0 inline-flex items-center justify-center " +
  "rounded-control border-3 border-line text-tinta text-[13px] leading-none " +
  "cursor-pointer shadow-hard font-cuerpo " +
  "transition-[transform,box-shadow] duration-75 ease-out " +
  "active:translate-x-0.5 active:translate-y-0.5 " +
  "active:shadow-[2px_2px_0_var(--color-line)] " +
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-line " +
  "disabled:opacity-50 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0";

/**
 * El estado de hoy deja de ser texto de color y pasa a ser un sello: fondo
 * macizo y tinta encima. Es la regla dura del sistema —el pastel es fondo,
 * nunca texto— y de paso se lee mejor de lejos que una palabra teñida.
 *
 * «Hecho» va en tinta maciza con la letra en papel, invertido. No usa ningún
 * pastel a propósito: menta, lavanda y rosa son identidad de hábito, y un sello
 * verde junto a una fila cuyo acento ES menta habría hecho que el color dejara
 * de significar nada. El amarillo sí es del armazón, así que el mínimo lo usa.
 */
const SELLO = {
  base: {
    fontFamily: "var(--font-cuerpo)",
    fontSize: 11.5,
    fontWeight: 700,
    whiteSpace: "nowrap",
    padding: "3px 8px",
    borderRadius: 999,
    border: "2px solid var(--color-line)",
  },
  hecho: { background: "var(--color-tinta)", color: "var(--color-paper)" },
  minimo: { background: "var(--color-yellow)", color: "var(--color-tinta)" },
  pendiente: {
    background: "var(--color-paper-2)",
    color: "var(--color-tinta)",
  },
  noToca: {
    background: "transparent",
    color: "var(--color-tinta)",
    borderStyle: "dashed" as const,
  },
} as const;

export function HabitRow(p: Props) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const { confirm, dialog } = useConfirm();

  function mark(partial: boolean) {
    if (!p.scheduledToday || pending) return;
    startTransition(async () => {
      emitToggleResult(await toggleToday(p.id, partial));
    });
  }

  async function remove() {
    const ok = await confirm({
      title: "Borrar hábito",
      message: `Se borrará "${p.name}" y todo su historial. Esto no se puede deshacer.`,
    });
    if (!ok) return;
    const fd = new FormData();
    fd.set("id", p.id);
    startTransition(() => deleteHabit(fd));
  }

  const plant = plantEmoji(
    p.plantSpecies,
    p.streak,
    p.doneToday,
    p.hasEverBeenDone,
  );
  const accent = habitColorVar(resolveHabitColor(p.color));
  const schedule = (p.schedule || DEFAULT_SCHEDULE).padEnd(7, "0");
  const custom = schedule !== DEFAULT_SCHEDULE;

  const state = !p.scheduledToday
    ? { text: "Hoy no toca", sello: SELLO.noToca }
    : p.doneToday && p.partialToday
      ? { text: "Mínimo", sello: SELLO.minimo }
      : p.doneToday
        ? { text: "Hecho", sello: SELLO.hecho }
        : { text: "Pendiente", sello: SELLO.pendiente };

  // El botón de marcar solo se comporta como tecla cuando de verdad se puede
  // pulsar. Si hoy no toca, se queda plano: prometer un hundido que no llega
  // sería mentir con la forma.
  const marcable = p.scheduledToday && !pending;

  function apuntar(n: number) {
    if (pending) return;
    startTransition(async () => {
      emitToggleResult(await apuntarCantidad(p.id, Math.max(0, n)));
    });
  }

  /*
    El aviso no es adorno: un hábito de cantidad por debajo del objetivo PIERDE
    la racha, y uno de modo mínimo no. Sin decirlo, la diferencia entre los dos
    parece un fallo.
  */
  const rachaEnRiesgo =
    p.targetCount !== null &&
    (p.countToday ?? 0) > 0 &&
    (p.countToday ?? 0) < p.targetCount;

  return (
    <div
      style={{
        /*
          El día crítico se marca con el fondo, no con el filo. Antes era un
          borde rojo translúcido; ahora todo lleva trazo de 3px, así que teñirlo
          no se distinguiría. El amarillo es el aviso del armazón —ni menta, ni
          lavanda, ni rosa, que son identidad— y lleva además el ▲ junto al
          sello, para que el aviso no dependa solo del tono.
        */
        background: p.criticalToday
          ? "var(--color-yellow)"
          : "var(--color-paper)",
        border: "3px solid var(--color-line)",
        borderRadius: "var(--radius-card)",
        // La franja de identidad va por dentro para no desplazar el contenido
        // ni romper el radio. Ahora convive con la sombra dura en la misma
        // declaración: una hacia dentro, la otra hacia fuera.
        boxShadow: `inset 8px 0 0 ${accent}, var(--shadow-hard)`,
        padding: 14,
        paddingLeft: 24,
        color: "var(--color-tinta)",
        fontFamily: "var(--font-cuerpo)",
        opacity: pending ? 0.5 : p.scheduledToday ? 1 : 0.7,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/*
          Marcar es lo que más se repite en toda la aplicación, así que aquí es
          donde el hundido tiene que notarse. El área de pulsar deja de ser
          transparente y pasa a ser una tecla de verdad: relleno, trazo de 3px y
          sombra dura que se encoge al pulsar. Es una tecla dentro de una
          tarjeta, y esa acumulación de trazos es el estilo, no un descuido.
        */}
        {/*
          Un hábito en pausa no sale como pendiente ni cuenta para las misiones,
          así que sin decirlo parecería simplemente desaparecido. El rótulo es lo
          que separa «está pausado» de «se ha roto algo».
        */}
        {p.enPausaHoy ? (
          <span
            className="label-mono px-2 py-1 rounded-control border-3 border-line bg-paper-2 text-tinta"
            title="Hoy está en pausa: no cuenta ni rompe la racha"
          >
            En pausa
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => mark(false)}
          disabled={pending || !p.scheduledToday}
          className={
            marcable
              ? "flex-1 min-w-0 flex items-center gap-3 text-left cursor-pointer " +
                "rounded-control border-3 border-line bg-paper-2 shadow-hard px-3 py-2 " +
                "font-cuerpo text-tinta " +
                "transition-[transform,box-shadow] duration-75 ease-out " +
                "active:translate-x-0.5 active:translate-y-0.5 " +
                "active:shadow-[2px_2px_0_var(--color-line)] " +
                "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-line"
              : "flex-1 min-w-0 flex items-center gap-3 text-left cursor-default " +
                "rounded-control border-3 border-dashed border-line bg-transparent px-3 py-2 " +
                "font-cuerpo text-tinta"
          }
          aria-label={
            p.registradoHoy
              ? `Desmarcar ${p.name}`
              : `Marcar ${p.name} como hecho`
          }
        >
          <span style={{ fontSize: 24 }} aria-hidden>
            {plant}
          </span>
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>
              {p.isAnchor ? "👑 " : ""}
              {p.icon} {p.name}
            </span>
            {/* La racha es un dato, así que va en VT323. 16px es su suelo. */}
            <span
              style={{
                display: "block",
                fontFamily: "var(--font-vt)",
                fontSize: 16,
                lineHeight: 1.1,
                fontVariantNumeric: "tabular-nums",
                marginTop: 2,
              }}
            >
              {p.streak === 1 ? "1 día de racha" : `${p.streak} días de racha`}
              {/*
                La racha aguanta un fallo, y cuando lo ha usado hay que DECIRLO.
                Enseñar un número limpio que no lo es sería la misma mentira de
                representación que mueve la conducta en el estudio de Silverman y
                Barasch: cuenta lo que el registro enseña, no lo que hiciste.
              */}
              {p.rachaPerdonados > 0 ? " · 1 día perdonado" : ""}
            </span>
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {p.criticalToday ? (
              <span aria-hidden style={{ fontSize: 13 }}>
                ▲
              </span>
            ) : null}
            <span style={{ ...SELLO.base, ...state.sello }}>{state.text}</span>
          </span>
        </button>

        {/*
          Un hábito de cantidad sustituye el botón de modo mínimo por el
          contador: son dos formas de lo mismo y tener las dos confundiría.
        */}
        {p.targetCount !== null ? (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button
              type="button"
              onClick={() => apuntar((p.countToday ?? 0) - 1)}
              disabled={pending || (p.countToday ?? 0) === 0}
              className={`${ICON_BUTTON} bg-paper`}
              aria-label={`Quitar uno a ${p.name}`}
            >
              −
            </button>
            <span
              style={{
                fontFamily: "var(--font-vt)",
                fontSize: 16,
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
                minWidth: 44,
                textAlign: "center",
              }}
            >
              {p.countToday ?? 0} / {p.targetCount}
            </span>
            <button
              type="button"
              onClick={() => apuntar((p.countToday ?? 0) + 1)}
              disabled={pending}
              className={`${ICON_BUTTON} bg-yellow`}
              aria-label={`Sumar uno a ${p.name}`}
            >
              +
            </button>
          </div>
        ) : p.scheduledToday && p.minimalGoal && !p.doneToday ? (
          <button
            type="button"
            onClick={() => mark(true)}
            disabled={pending}
            className={`${ICON_BUTTON} bg-yellow`}
            title={`Modo mínimo: ${p.minimalGoal}`}
            aria-label={`Marcar ${p.name} en modo mínimo: ${p.minimalGoal}`}
          >
            ◐
          </button>
        ) : null}

        <button
          type="button"
          onClick={() =>
            startTransition(() => setHabitAnchor(p.id, !p.isAnchor))
          }
          disabled={pending}
          // Ancla encendida: fondo amarillo. Apagada: papel. El estado ya iba
          // además en `aria-pressed`, que no se toca.
          className={`${ICON_BUTTON} ${p.isAnchor ? "bg-yellow" : "bg-paper"}`}
          aria-pressed={p.isAnchor}
          aria-label={
            p.isAnchor
              ? `Quitar ${p.name} como hábito ancla`
              : `Designar ${p.name} como hábito ancla`
          }
        >
          👑
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={pending}
          className={`${ICON_BUTTON} bg-paper`}
          aria-expanded={open}
          aria-label={
            open ? `Ocultar detalles de ${p.name}` : `Ver detalles de ${p.name}`
          }
        >
          {open ? "▴" : "▾"}
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          // Peach es el acento destructivo del armazón, el mismo que la
          // variante `danger` de `<Button>` y el banner crítico.
          className={`${ICON_BUTTON} bg-peach`}
          aria-label={`Borrar ${p.name}`}
        >
          ✕
        </button>
      </div>

      {/*
        LA INTENCIÓN, ARRIBA Y EDITABLE.

        Estaba al fondo de la fila, en cursiva y solo de lectura — y
        `updateHabitIntention` existía como server action sin que nada la
        llamara, así que un hábito creado sin intención no podía ganarla nunca.

        Sube aquí porque es LA SEÑAL: Stawarz et al. (CHI 2015) midieron que
        anclar la conducta a un evento que ya ocurre aumenta la automaticidad,
        mientras que apoyarse en recordatorios por hora la DIFICULTA. Revisaron
        115 apps de hábitos y ninguna soportaba señales de este tipo. Este campo
        es exactamente eso, y estaba escondido.

        El aviso de cuando falta no lleva color de alarma ni signo de admiración:
        es una sugerencia, no una regañina. Todo el rediseño va en contra de
        castigar, y castigar por no rellenar un campo opcional sería lo mismo con
        otra ropa.
      */}
      <input
        defaultValue={p.intention ?? ""}
        maxLength={140}
        placeholder="Cuando… entonces…"
        onBlur={(e) => {
          const v = e.target.value;
          if (v.trim() === (p.intention ?? "")) return;
          startTransition(() => updateHabitIntention(p.id, v));
        }}
        aria-label={`Intención de ${p.name}: cuándo y dónde lo harás`}
        className="w-full mt-2 bg-paper-2 text-tinta font-cuerpo text-[12.5px] italic border-3 border-line rounded-control px-2 py-1 placeholder:text-tinta-2 outline-none focus:outline-3 focus:outline-offset-2 focus:outline-line"
      />
      {/*
        EL TERCER ESTADO. Ni activo ni borrado: ya está formado.

        Borrar un hábito conseguido castiga por haberlo conseguido, y dejarlo
        activo para siempre convierte un éxito en una tarea perpetua. Epstein et
        al. (CHI 2016) lo llaman «abandono feliz», y la métrica dominante del
        sector no lo distingue del fracaso desde 2005.

        Va sin adorno ni celebración: es un cambio de estado, no un trofeo.
      */}
      {p.interiorizadoEl ? (
        <div style={{ fontSize: 12, marginTop: 8 }}>
          Lo diste por hecho el{" "}
          <b>{p.interiorizadoEl.toLocaleDateString("es-ES")}</b>. No se te pide
          y no cuenta como fallo.{" "}
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(() => marcarInteriorizado(p.id, false))
            }
            className="underline bg-transparent border-0 p-0 font-cuerpo text-[12px] text-tinta cursor-pointer"
          >
            Volver a pedírmelo
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => marcarInteriorizado(p.id, true))}
          className="underline bg-transparent border-0 p-0 mt-2 font-cuerpo text-[11.5px] text-tinta cursor-pointer"
        >
          Ya no necesito que me lo pidas
        </button>
      )}

      {!p.intention ? (
        <div style={{ fontSize: 11.5, marginTop: 4 }}>
          Atarlo a algo que ya haces —«cuando me siente a desayunar»— funciona
          mejor que proponerse una hora.
        </div>
      ) : null}

      {/*
        Se guarda al SALIR del campo, como el título de la tarea: escribir una
        nota no debería pedir un botón, y guardar por tecla mandaría una petición
        por letra.

        `hoyISO` viene del servidor y no del navegador: la fecha del cliente
        puede diferir y la nota acabaría en otro día.
      */}
      <textarea
        defaultValue={p.notaHoy ?? ""}
        rows={1}
        maxLength={500}
        placeholder="Nota de hoy…"
        onBlur={(e) => {
          const v = e.target.value;
          if (v.trim() === (p.notaHoy ?? "")) return;
          startTransition(() => guardarNota(p.id, p.hoyISO, v));
        }}
        aria-label={`Nota de hoy para ${p.name}`}
        className="w-full mt-2 bg-paper-2 text-tinta font-cuerpo text-[12.5px] border-3 border-line rounded-control px-2 py-1 placeholder:text-tinta-2 outline-none focus:outline-3 focus:outline-offset-2 focus:outline-line resize-y"
      />

      {rachaEnRiesgo ? (
        <div style={{ fontSize: 11.5, marginTop: 6 }}>
          Por debajo del objetivo: la racha no está a salvo.
        </div>
      ) : null}
      {p.minimalGoal && p.targetCount === null ? (
        <div style={{ fontSize: 12, marginTop: 6 }}>
          Modo mínimo: {p.minimalGoal}
        </div>
      ) : null}

      {custom ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            marginTop: 10,
          }}
        >
          {WEEKDAY_ORDER.map((weekday) => {
            const on = schedule[weekday] === "1";
            return (
              /*
                Celda de 24px para que quepa VT323 a 18: por debajo de 16 deja
                de leerse, así que manda la fuente sobre el tamaño de la celda.

                Los días que tocan van sellados —tinta maciza, letra en papel— y
                los que no, con trazo discontinuo sobre nada. La diferencia es
                de forma además de tono: en una celda de 24px, fiarlo todo al
                color es lo que hace que dos estados se confundan.
              */
              <span
                key={weekday}
                title={on ? "Toca" : "No toca"}
                style={{
                  width: 24,
                  height: 24,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 6,
                  fontFamily: "var(--font-vt)",
                  fontSize: 18,
                  lineHeight: 1,
                  background: on ? "var(--color-tinta)" : "transparent",
                  border: `2px ${on ? "solid" : "dashed"} var(--color-line)`,
                  color: on ? "var(--color-paper)" : "var(--color-tinta)",
                }}
              >
                {WEEKDAY_LABELS[weekday]}
              </span>
            );
          })}
        </div>
      ) : null}

      {open ? <HabitDetail habitId={p.id} habitName={p.name} /> : null}
      {dialog}
    </div>
  );
}
