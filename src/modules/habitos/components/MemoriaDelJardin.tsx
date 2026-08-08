"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { HabitWithStatus } from "@/modules/habitos/lib/habits";
import type { HabitoHistorico, PlantaEn } from "@/modules/habitos/lib/historia";
import {
  jardinEn,
  primerDiaConDatos,
  semanaEn,
} from "@/modules/habitos/lib/historia";
import { climaDe, type Tiempo } from "@/modules/habitos/lib/clima";
import {
  addDays,
  dayKeyFromISO,
  daysBetween,
  formatDayLabel,
  isoFromDayKey,
} from "@/modules/habitos/lib/day";
import { buttonStyle } from "@/modules/core/ui/Button";
import type { Decoracion } from "@/modules/habitos/lib/decoraciones";
import {
  faunaEn,
  fraseDeFauna,
  type DiaDeFauna,
} from "@/modules/habitos/lib/fauna";
import { GardenScene } from "./GardenScene";

/*
  El jardín, y debajo la barra para viajar a cualquier día.

  Todo el recorrido pasa AQUÍ, en el navegador. Los datos llegan una sola vez y
  cada día se reconstruye al vuelo. Pedir cada día al servidor haría que
  arrastrar el deslizador disparase una petición por día, y el timelapse iría a
  trompicones.
*/

type Props = {
  /** El jardín de hoy, tal y como lo calcula el servidor. */
  habitsHoy: HabitWithStatus[];
  tiempoHoy: Tiempo;
  historia: HabitoHistorico[];
  /** Hoy, en clave de día, para que el cliente no lo deduzca de su reloj. */
  hoyISO: string;
  decoraciones: Decoracion[];
  fauna: DiaDeFauna[];
};

/**
 * Una planta reconstruida, vestida de hábito para que la escena la pinte.
 *
 * La escena habla `HabitWithStatus` y no hay motivo para enseñarle un segundo
 * idioma: lo que dibuja de una planta —racha, especie, color, si se cumplió y
 * si tocaba— existe igual en las dos formas.
 *
 * Los campos que la escena NO mira van con el valor que significa «aquí no
 * aplica». Si algún día la escena empieza a leer uno de ellos, esto se convierte
 * en una mentira silenciosa; por eso están todos escritos a mano y ninguno se
 * rellena con un `as`.
 */
function comoHabito(p: PlantaEn, slot: number | null): HabitWithStatus {
  return {
    id: p.id,
    name: p.name,
    icon: "star",
    color: p.color,
    plantSpecies: p.plantSpecies,
    minimalGoal: null,
    isAnchor: p.isAnchor,
    schedule: "1111111",
    intention: null,
    doneToday: p.cumplidoEseDia,
    // En el pasado no se riega ni se borra nada, así que este campo no llega a
    // usarse. Se rellena con lo más cercano a la verdad: si el día contó, hubo
    // registro.
    registradoHoy: p.cumplidoEseDia,
    partialToday: false,
    targetCount: null,
    gardenSlot: slot,
    notaHoy: null,
    enPausaHoy: false,
    countToday: null,
    scheduledToday: p.programadoEseDia,
    criticalToday: false,
    streak: p.streak,
    // La memoria no pinta carteles de racha, así que este dato no se usa allí.
    rachaPerdonados: 0,
    hasEverBeenDone: p.algunaVezCumplido,
    last30: [],
  };
}

export function MemoriaDelJardin({
  habitsHoy,
  tiempoHoy,
  historia,
  hoyISO,
  decoraciones,
  fauna,
}: Props) {
  const hoy = useMemo(() => dayKeyFromISO(hoyISO), [hoyISO]);
  const primero = useMemo(() => primerDiaConDatos(historia), [historia]);

  // `null` es hoy. Se guarda así y no como la fecha de hoy para que el jardín
  // vivo sea el estado por defecto sin depender de comparar dos fechas.
  const [diaISO, setDiaISO] = useState<string | null>(null);

  // `daysBetween` es `a - b`: cuántos días hay de aquel primero hasta hoy.
  const total = hoy && primero ? daysBetween(hoy, primero) : 0;
  // Sin registros no hay pasado, y una barra de un solo día es peor que ninguna.
  const hayMemoria = hoy !== null && primero !== null && total > 0;

  const dia = diaISO ? dayKeyFromISO(diaISO) : hoy;
  const enElPasado = hayMemoria && diaISO !== null;

  const reconstruido = useMemo(() => {
    if (!enElPasado || !dia || !hoy) return null;
    const huecos = new Map(habitsHoy.map((h) => [h.id, h.gardenSlot]));
    const plantas = jardinEn(historia, dia, hoy).map((p) =>
      comoHabito(p, huecos.get(p.id) ?? null),
    );
    const semana = semanaEn(historia, dia);
    return { plantas, tiempo: climaDe(semana.cumplidos, semana.fallados) };
  }, [enElPasado, dia, hoy, historia, habitsHoy]);

  function irA(indice: number) {
    if (!primero || !hoy) return;
    const acotado = Math.max(0, Math.min(total, indice));
    setDiaISO(
      acotado === total ? null : isoFromDayKey(addDays(primero, acotado)),
    );
  }

  const indice =
    enElPasado && primero && dia ? daysBetween(dia, primero) : total;

  return (
    <>
      <GardenScene
        habits={reconstruido ? reconstruido.plantas : habitsHoy}
        tiempo={reconstruido ? reconstruido.tiempo : tiempoHoy}
        soloLectura={enElPasado}
        decoraciones={decoraciones}
        fauna={dia ? faunaEn(fauna, dia) : { pajaros: 0, mariposas: 0 }}
      />
      {/*
        El recuento en TEXTO. La fauna es el adorno de un dato que se puede leer,
        no la única forma de saberlo.
      */}
      <p style={{ fontSize: 12, marginTop: 8 }}>
        {dia ? fraseDeFauna(fauna, dia) : null}
      </p>
      {hayMemoria ? (
        <BarraDeTiempo
          indice={indice}
          total={total}
          diaISO={diaISO}
          irA={irA}
          alPresente={() => setDiaISO(null)}
        />
      ) : null}
    </>
  );
}

/** Cuánto tarda el timelapse en pasar de un día al siguiente. */
const PASO_MS = 550;

const MENOS_MOVIMIENTO = "(prefers-reduced-motion: reduce)";

// Fuera del componente para que las dos funciones sean las MISMAS entre
// renders: `useSyncExternalStore` vuelve a suscribirse si cambian de identidad.
function suscribir(avisar: () => void) {
  const mq = window.matchMedia(MENOS_MOVIMIENTO);
  mq.addEventListener("change", avisar);
  return () => mq.removeEventListener("change", avisar);
}
const leerCliente = () => window.matchMedia(MENOS_MOVIMIENTO).matches;
// En el servidor no hay preferencia que consultar. `false` es lo que no cambia
// nada: los botones salen igual y quien tenga la preferencia lo nota en cuanto
// hidrata.
const leerServidor = () => false;

function BarraDeTiempo({
  indice,
  total,
  diaISO,
  irA,
  alPresente,
}: {
  indice: number;
  total: number;
  diaISO: string | null;
  irA: (i: number) => void;
  alPresente: () => void;
}) {
  const [reproduciendo, setReproduciendo] = useState(false);
  const menosMovimiento = useSyncExternalStore(
    suscribir,
    leerCliente,
    leerServidor,
  );

  /*
    El índice y el salto viven en refs para que el intervalo se monte UNA vez.
    Si dependiera de ellos se recrearía en cada día y el reloj volvería a cero
    justo antes de cumplirse, así que el recorrido no avanzaría nunca.

    Se escriben en un efecto y no durante el render: escribir una ref mientras se
    pinta es lo que prohíbe el compilador de React, y con razón —un render puede
    descartarse, y la ref se quedaría con lo que nunca llegó a pintarse—.
  */
  const actual = useRef(indice);
  const saltar = useRef(irA);
  useEffect(() => {
    actual.current = indice;
    saltar.current = irA;
  });

  useEffect(() => {
    if (!reproduciendo) return;
    const id = setInterval(() => {
      if (actual.current >= total) {
        setReproduciendo(false);
        return;
      }
      saltar.current(actual.current + 1);
    }, PASO_MS);
    return () => clearInterval(id);
  }, [reproduciendo, total]);

  const enHoy = diaISO === null;
  const etiqueta = diaISO === null ? "Hoy" : formatDayLabel(diaISO);

  return (
    <div
      style={{
        marginTop: 12,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 10,
      }}
    >
      {/*
        El día va en TEXTO y no solo en la posición del control. Es la regla de
        siempre: nunca una sola señal, y menos si esa señal es «dónde está la
        bolita».
      */}
      <div
        role="status"
        aria-live="polite"
        style={{
          fontFamily: "var(--font-vt)",
          fontSize: 18,
          minWidth: "8rem",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {etiqueta}
      </div>

      <button
        type="button"
        onClick={() => irA(indice - 1)}
        disabled={indice <= 0}
        aria-label="Un día atrás"
        style={buttonStyle("ghost")}
      >
        ◀
      </button>

      {/*
        Un `input type=range` de verdad. Las flechas, Inicio y Fin funcionan
        solos, y ese es justo el motivo de no dibujar uno a mano.
      */}
      <input
        type="range"
        min={0}
        max={total}
        value={indice}
        onChange={(e) => irA(Number(e.target.value))}
        aria-label={`Día del jardín: ${etiqueta}`}
        style={{
          flex: "1 1 12rem",
          minWidth: "8rem",
          accentColor: "var(--color-tinta)",
        }}
      />

      <button
        type="button"
        onClick={() => irA(indice + 1)}
        disabled={indice >= total}
        aria-label="Un día adelante"
        style={buttonStyle("ghost")}
      >
        ▶
      </button>

      <button
        type="button"
        onClick={() => {
          if (reproduciendo) return setReproduciendo(false);
          // Reproducir desde el final no enseñaría nada: se vuelve al principio.
          if (indice >= total) irA(0);
          setReproduciendo(true);
        }}
        aria-label={reproduciendo ? "Pausar el recorrido" : "Recorrer los días"}
        style={buttonStyle("ghost")}
      >
        {reproduciendo ? "❚❚ Pausar" : "▶ Recorrer"}
      </button>

      <button
        type="button"
        onClick={() => {
          setReproduciendo(false);
          alPresente();
        }}
        disabled={enHoy}
        style={buttonStyle(enHoy ? "ghost" : "primary")}
      >
        Volver a hoy
      </button>

      {menosMovimiento ? (
        // No se arranca solo, pero el botón sigue ahí: quien lo pida, lo tiene.
        <p style={{ fontSize: 11.5, width: "100%" }}>
          Tienes activado «reducir movimiento», así que el recorrido no arranca
          solo. Púlsalo tú cuando quieras.
        </p>
      ) : null}
    </div>
  );
}
