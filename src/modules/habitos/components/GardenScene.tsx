"use client";

import { useMemo, useState, useTransition, type CSSProperties } from "react";
import type { HabitWithStatus } from "@/modules/habitos/lib/habits";
import { useLocalHour } from "@/modules/habitos/lib/useLocalHour";
import { ETIQUETA, type Tiempo } from "@/modules/habitos/lib/clima";
import {
  isPlantWilted,
  plantStateLabel,
  stageFor,
} from "@/modules/habitos/lib/garden";
import { Sprite } from "@/modules/core/ui/pixel/Sprite";
import { spriteDe } from "@/modules/habitos/lib/sprites";
import {
  AURORA,
  LUNA,
  NUBE,
  CORONA,
  DESTELLO,
  NUBE_LLUVIA,
  SOL,
} from "@/modules/habitos/lib/sprites/cielo";
import { habitColorVar, resolveHabitColor } from "@/modules/habitos/lib/color";
import { formatDays } from "@/modules/habitos/lib/day";
import { asignarHuecos } from "@/modules/habitos/lib/huecos";
import {
  HORIZONTE,
  disposicionDelJardin,
} from "@/modules/habitos/lib/disposicion";
import { TIENDA, type Decoracion } from "@/modules/habitos/lib/decoraciones";
import type { Fauna } from "@/modules/habitos/lib/fauna";
import { MARIPOSA, PAJARO } from "@/modules/habitos/lib/sprites/fauna";
import { moverPlanta, toggleToday } from "@/modules/habitos/actions";
import { emitToggleResult } from "@/modules/habitos/lib/events";
import { useSparkleBurst, SparkleLayer } from "./Sparkle";

type Props = {
  habits: HabitWithStatus[];
  tiempo: Tiempo;
  /**
   * Un día que no es hoy. Ni se riega ni se recolocan las plantas.
   *
   * Regar el pasado no es que sea difícil: es que no significa nada. Un registro
   * lleva su fecha, y crear uno con fecha de junio no sería recordar, sería
   * falsear.
   */
  soloLectura?: boolean;
  /** Lo comprado en la tienda. Vacío = la escena se ve exactamente como antes. */
  decoraciones?: Decoracion[];
  /**
   * Los bichos de ese día: pájaros por la música, mariposas por las tareas.
   *
   * Cero de algo es cero de eso. No se rellena para que la escena no parezca
   * vacía: si el día estuvo vacío, la escena lo dice.
   */
  fauna?: Fauna;
};

type SkyPhase = "dawn" | "morning" | "midday" | "afternoon" | "dusk" | "night";

function phaseFor(hour: number): SkyPhase {
  if (hour < 6) return "night";
  if (hour < 9) return "dawn";
  if (hour < 12) return "morning";
  if (hour < 15) return "midday";
  if (hour < 18) return "afternoon";
  if (hour < 21) return "dusk";
  return "night";
}

/** Donde acaba el cielo y empieza la tierra. */
const HORIZON = `${HORIZONTE}%`;

/*
  El cielo es UN SOLO TONO por fase.

  Antes eran tres bandas planas por fase, con las paradas duras a propósito para
  que la escena se leyera como pixel art. Se probó en pantalla y no funcionaba: el
  lila y el rosa del atardecer se leían como franjas puestas encima del cielo, no
  como cielo. Se van los dos y queda el tono de arriba de cada fase.

  El bandeado sobrevive donde sí funciona —en el suelo, aquí debajo—, que es una
  franja estrecha y en la que dos tonos leen como tierra y sombra.

  Consecuencia asumida, y medida con `contraste.ts` en vez de a ojo: con un tono
  cada una, `dawn` y `dusk` quedan a ΔE 3,4 y `morning` y `afternoon` a 3,9. Por
  debajo de 5 la diferencia apenas se nota, así que cuatro de las seis fases se
  leen como dos parejas. El tono ya NO dice la hora.

  Se sostiene porque la fase va ESCRITA en su pegatina, arriba a la izquierda:
  aquí también vale la regla de siempre, nunca una sola señal. Si algún día se
  quiere recuperar la diferencia, hay que separar esos dos pares —no volver a las
  bandas.
*/
const SKY: Record<SkyPhase, string> = {
  dawn: "#2b2440",
  morning: "#4a6f9e",
  midday: "#3d7ab5",
  afternoon: "#55749e",
  dusk: "#241d38",
  night: "#0c0c14",
};

// El suelo SÍ conserva sus dos bandas: es estrecho, y ahí el corte duro lee como
// tierra y sombra en vez de como una franja pegada encima.
const GROUND: Record<SkyPhase, string> = {
  dawn: "linear-gradient(180deg, #3a4a2c 0 50%, #26301c 50% 100%)",
  morning: "linear-gradient(180deg, #46603a 0 50%, #2c3d24 50% 100%)",
  midday: "linear-gradient(180deg, #4d6b3d 0 50%, #314426 50% 100%)",
  afternoon: "linear-gradient(180deg, #445c36 0 50%, #2b3a22 50% 100%)",
  dusk: "linear-gradient(180deg, #2f3a24 0 50%, #1e2617 50% 100%)",
  night: "linear-gradient(180deg, #1b2416 0 50%, #121810 50% 100%)",
};

// El amanecer y el atardecer también cuentan como "oscuros" para las estrellas,
// así que el dibujo no puede deducirse de isDark: si se dedujera, la aurora no
// saldría nunca y esas dos franjas del día se verían de noche.
function skySprite(phase: SkyPhase): string {
  if (phase === "dawn" || phase === "dusk") return AURORA;
  if (phase === "night") return LUNA;
  return SOL;
}

const SKY_LABEL: Record<SkyPhase, string> = {
  dawn: "Amanecer",
  morning: "Mañana",
  midday: "Mediodía",
  afternoon: "Tarde",
  dusk: "Atardecer",
  night: "Noche",
};

/*
  Todo lo que se pone encima de la escena va en papel con tinta. Es lo único que
  garantiza contraste sobre seis cielos distintos: 9,76:1 tanto sobre el
  mediodía como sobre la medianoche. Las cápsulas negras translúcidas de antes
  dependían de que el cielo fuera claro.
*/
const PEGATINA: CSSProperties = {
  background: "var(--color-paper)",
  color: "var(--color-tinta)",
  border: "2px solid var(--color-line)",
  fontFamily: "var(--font-cuerpo)",
};

function seedRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

export function GardenScene({
  habits,
  tiempo,
  soloLectura = false,
  decoraciones = [],
  fauna = { pajaros: 0, mariposas: 0 },
}: Props) {
  const hour = useLocalHour();
  const phase: SkyPhase = hour === null ? "night" : phaseFor(hour);
  const isDark = phase === "night" || phase === "dusk" || phase === "dawn";

  // Sembrado con los hábitos: la escena no baila en cada render.
  const rand = seedRand(
    habits.length * 31 + (habits[0]?.id.charCodeAt(0) ?? 7),
  );
  const stars = Array.from({ length: 22 }, () => ({
    left: 2 + rand() * 96,
    top: 2 + rand() * 38,
    size: 2 + Math.floor(rand() * 2),
    delay: rand() * 1.6,
  }));
  /*
    Las nubes ya no son cuatro fijas: son las que le tocan a tu semana. Cero si
    está despejado, cuatro si llueve. La cantidad ES la señal, para que el estado
    no dependa de distinguir un emoji pequeño.
  */
  const clouds = Array.from({ length: tiempo.nubes }, (_, i) => ({
    left: 5 + i * 22 + rand() * 6,
    top: 6 + rand() * 18,
    size: 1.4 + rand() * 0.6,
    speed: 40 + rand() * 30,
    delay: rand() * 20,
  }));

  /*
    Las columnas y la altura salen de `disposicionDelJardin` y ya no de una raíz
    cuadrada a ojo. Con la raíz, tres plantas daban dos columnas —o sea dos
    filas— que no cabían bajo el horizonte, y lo que sobraba desbordaba HACIA
    ARRIBA: las plantas salían flotando en el cielo.
  */
  const { columnas: columns, minAlto } = disposicionDelJardin(habits.length);
  const fade = "background 1500ms ease-in-out";

  /*
    El orden que manda el servidor. `asignarHuecos` reparte los huecos que
    faltan; ordenar por hueco es lo que hace que cada planta salga donde la
    dejaste y no donde caiga por antigüedad.
  */
  const ordenServidor = useMemo(() => {
    const huecos = asignarHuecos(
      habits.map((h) => ({ id: h.id, slot: h.gardenSlot })),
    );
    return [...habits]
      .sort((a, b) => (huecos.get(a.id) ?? 0) - (huecos.get(b.id) ?? 0))
      .map((h) => h.id);
  }, [habits]);

  /*
    El orden que se ve. Va aparte del de arriba porque al mover una planta se
    reordena AQUÍ en el acto y el guardado va detrás: esperar al servidor para
    pintar el cambio haría que arrastrar diera un tirón.

    Se resincroniza comparando la clave durante el render —el patrón de estado
    derivado— y no con un efecto: un efecto pintaría primero el orden viejo.
  */
  const clave = ordenServidor.join(" ");
  const [visto, setVisto] = useState({ clave, orden: ordenServidor });
  if (visto.clave !== clave) setVisto({ clave, orden: ordenServidor });

  const porId = new Map(habits.map((h) => [h.id, h]));
  const orden = visto.orden.filter((id) => porId.has(id));

  const [agarrada, setAgarrada] = useState<string | null>(null);
  // Los intercambios hechos desde que se agarró, para poder deshacerlos con
  // Escape. Cada uno es su propio inverso, así que cancelar es repetirlos al
  // revés.
  const [pila, setPila] = useState<[string, string][]>([]);
  const [, mover] = useTransition();

  function intercambiarPlantas(a: string, b: string, apilar: boolean) {
    if (a === b) return;
    const i = orden.indexOf(a);
    const j = orden.indexOf(b);
    if (i < 0 || j < 0) return;
    const nuevo = [...orden];
    nuevo[i] = b;
    nuevo[j] = a;
    setVisto({ clave, orden: nuevo });
    if (apilar) setPila((p) => [...p, [a, b]]);
    mover(async () => {
      await moverPlanta(a, b);
    });
  }

  /** Suelta la planta donde esté. Escape además deshace lo andado. */
  function soltar(cancelando: boolean) {
    if (cancelando && pila.length > 0) {
      let actual = orden;
      for (let k = pila.length - 1; k >= 0; k -= 1) {
        const [a, b] = pila[k];
        const i = actual.indexOf(a);
        const j = actual.indexOf(b);
        if (i < 0 || j < 0) continue;
        const nuevo = [...actual];
        nuevo[i] = b;
        nuevo[j] = a;
        actual = nuevo;
        mover(async () => {
          await moverPlanta(a, b);
        });
      }
      setVisto({ clave, orden: actual });
    }
    setPila([]);
    setAgarrada(null);
  }

  /** Un paso del teclado: izquierda y derecha van de una en una; arriba y abajo, de fila en fila. */
  function pasoDe(tecla: string): number | null {
    if (tecla === "ArrowLeft") return -1;
    if (tecla === "ArrowRight") return 1;
    if (tecla === "ArrowUp") return -columns;
    if (tecla === "ArrowDown") return columns;
    return null;
  }

  function alPulsar(e: React.KeyboardEvent, id: string) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (agarrada === id) soltar(false);
      else {
        setPila([]);
        setAgarrada(id);
      }
      return;
    }
    if (agarrada !== id) return;
    if (e.key === "Escape") {
      e.preventDefault();
      soltar(true);
      return;
    }
    const paso = pasoDe(e.key);
    if (paso === null) return;
    e.preventDefault();
    const destino = orden.indexOf(id) + paso;
    // Fuera de la rejilla no hay nada: el borde para, no da la vuelta.
    if (destino < 0 || destino >= orden.length) return;
    intercambiarPlantas(id, orden[destino], true);
  }

  const nombreAgarrado = agarrada ? porId.get(agarrada)?.name : null;
  const aviso = nombreAgarrado
    ? `${nombreAgarrado} agarrada, en el sitio ${orden.indexOf(agarrada!) + 1} de ${orden.length}. Muévela con las flechas, Enter para soltarla, Escape para dejarla donde estaba.`
    : "";

  return (
    <div
      style={{
        position: "relative",
        // La escena se lee como una lámina puesta sobre el papel.
        border: "3px solid var(--color-line)",
        borderRadius: "var(--radius-card)",
        boxShadow: "var(--shadow-hard)",
        overflow: "hidden",
        minHeight: minAlto,
      }}
    >
      {/*
        El cielo llega HASTA EL HORIZONTE, no hasta el fondo de la escena.

        Antes iba con `inset: 0`, o sea toda la escena, y sus tres bandas caían
        en 0-161, 161-318 y 318-474 px con el suelo empezando en 297: la tercera
        —el resplandor cálido pegado al horizonte, lo que hace que un atardecer
        parezca un atardecer— quedaba ENTERA debajo de la tierra. Lo que se veía
        era la mitad inferior del degradado sin nada cálido debajo, y esa franja
        lila se leía como un bloque plano en vez de como cielo.

        Las paradas siguen siendo duras: el bandeado no era el problema, el
        encuadre sí.
      */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: HORIZON,
          background: SKY[phase],
          transition: fade,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: HORIZON,
          bottom: 0,
          background: GROUND[phase],
          // El horizonte era el único corte duro de la escena y por eso se leía
          // como horizonte. Ahora hay tres más arriba, así que se marca.
          borderTop: "3px solid var(--color-line)",
          transition: fade,
        }}
      />

      <div
        style={{
          ...PEGATINA,
          position: "absolute",
          top: 12,
          left: 12,
          zIndex: 20,
          padding: "3px 9px",
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 700,
        }}
      >
        {SKY_LABEL[phase]}
      </div>

      {/*
        El tiempo va en TEXTO, no solo en la forma de las nubes: es la regla del
        rediseño —nunca una sola señal— y aquí además el emoji es diminuto.

        El `title` dice de dónde sale el dato, para que «Lluvia» no se lea como un
        juicio sobre ti sino como el recuento que es.
      */}
      <div
        title={
          tiempo.evaluables === 0
            ? "Aún no hay días que evaluar esta semana"
            : `${tiempo.cumplidos} de ${tiempo.evaluables} días cumplidos esta semana`
        }
        style={{
          ...PEGATINA,
          position: "absolute",
          top: 12,
          right: 12,
          zIndex: 20,
          padding: "3px 9px",
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 700,
        }}
      >
        {ETIQUETA[tiempo.estado]}
      </div>

      <span
        aria-hidden
        style={{
          position: "absolute",
          right: 20,
          top: 14,
          zIndex: 10,
          fontSize: 32,
          pointerEvents: "none",
          userSelect: "none",
          filter:
            phase === "midday"
              ? "drop-shadow(0 0 14px rgba(245, 200, 158, 0.7))"
              : "drop-shadow(0 0 10px rgba(245, 200, 158, 0.4))",
        }}
      >
        {/* El dibujo cambia; QUIÉN decide sigue siendo la hora real. */}
        <Sprite grid={skySprite(phase)} size={38} label="" />
      </span>

      {isDark
        ? stars.map((s, i) => (
            <span
              key={`star-${i}`}
              className="untap-pulse"
              aria-hidden
              style={{
                position: "absolute",
                left: `${s.left}%`,
                top: `${s.top}%`,
                width: s.size,
                height: s.size,
                // Cuadradas y sin halo: un píxel no tiene esquinas redondeadas
                // ni resplandor.
                background: "#f2f2f5",
                animationDelay: `${s.delay}s`,
                pointerEvents: "none",
              }}
            />
          ))
        : null}

      {/*
        Los adornos van DETRÁS de las plantas —z-index 5 contra 10— y son
        decorativos: su nombre vive en la tienda, que es donde se interactúa con
        ellos. Repetirlo aquí lo diría dos veces sin añadir nada.
      */}
      {decoraciones.map((kind) => {
        const d = TIENDA[kind];
        return (
          <span
            key={kind}
            aria-hidden
            style={{
              position: "absolute",
              left: d.sitio.left,
              top: d.sitio.top,
              transform: "translate(-50%, -50%)",
              zIndex: 5,
              pointerEvents: "none",
              userSelect: "none",
            }}
          >
            <Sprite grid={d.grid} size={d.sitio.tamano} label="" />
          </span>
        );
      })}

      {/*
        Los pájaros cruzan el cielo con la misma deriva que las nubes, y las
        mariposas revolotean entre las plantas. Los dos son `aria-hidden`: lo que
        se lee es la frase del recuento, debajo de la escena. Un bicho pequeño y
        en movimiento es de lo peor que se le puede pedir a la vista.
      */}
      {Array.from({ length: fauna.pajaros }, (_, i) => (
        <span
          key={`ave-${i}`}
          aria-hidden
          style={{
            position: "absolute",
            left: `${6 + i * 21}%`,
            top: `${12 + i * 7}%`,
            zIndex: 8,
            animation: `cloud-drift ${52 + i * 9}s linear infinite`,
            animationDelay: `-${i * 11}s`,
            pointerEvents: "none",
            userSelect: "none",
            opacity: isDark ? 0.5 : 0.9,
          }}
        >
          <Sprite grid={PAJARO} size={20} label="" />
        </span>
      ))}

      {Array.from({ length: fauna.mariposas }, (_, i) => (
        <span
          key={`mariposa-${i}`}
          className="untap-bobble"
          aria-hidden
          style={{
            position: "absolute",
            left: `${11 + i * 18}%`,
            top: `${66 + (i % 3) * 6}%`,
            zIndex: 12,
            animationDelay: `${i * 0.4}s`,
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          <Sprite grid={MARIPOSA} size={16} label="" />
        </span>
      ))}

      {clouds.map((c, i) => (
        <span
          key={`cloud-${i}`}
          aria-hidden
          style={{
            position: "absolute",
            left: `${c.left}%`,
            top: `${c.top}%`,
            fontSize: `${c.size}rem`,
            opacity: isDark ? 0.22 : 0.45,
            animation: `cloud-drift ${c.speed}s linear infinite`,
            animationDelay: `-${c.delay}s`,
            filter: isDark ? "grayscale(0.5)" : "none",
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          <Sprite
            grid={tiempo.estado === "lluvia" ? NUBE_LLUVIA : NUBE}
            size={c.size * 22}
            label=""
          />
        </span>
      ))}

      <div
        style={{
          position: "absolute",
          left: "3%",
          right: "3%",
          // EN el horizonte, no cuatro puntos por encima. Ahí arriba es cielo.
          top: HORIZON,
          bottom: "1.25rem",
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            gap: 12,
            height: "100%",
            alignContent: "end",
          }}
        >
          {orden.map((id, i) => {
            const h = porId.get(id)!;
            return (
              <div
                key={id}
                onDragOver={(e) => {
                  if (!soloLectura) e.preventDefault();
                }}
                onDrop={(e) => {
                  if (soloLectura) return;
                  e.preventDefault();
                  const suelta = e.dataTransfer.getData("text/plain");
                  if (suelta) intercambiarPlantas(suelta, id, false);
                  setAgarrada(null);
                }}
                style={{ display: "flex", justifyContent: "center" }}
              >
                <GardenPlant
                  habit={h}
                  soloLectura={soloLectura}
                  agarrada={agarrada === id}
                  sitio={i + 1}
                  total={orden.length}
                  onAsaDown={(e) => alPulsar(e, id)}
                  onArrastrar={(e) => {
                    e.dataTransfer.setData("text/plain", id);
                    e.dataTransfer.effectAllowed = "move";
                    setPila([]);
                    setAgarrada(id);
                  }}
                  onSoltarAsa={() => {
                    if (agarrada === id) soltar(false);
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/*
        Lo que pasa al mover con el teclado no se ve si no miras la pantalla, así
        que se dice. `polite` y no `assertive`: es un acompañamiento, no una
        alarma que deba cortar lo que el lector esté leyendo.
      */}
      <div
        role="status"
        aria-live="polite"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          clipPath: "inset(50%)",
          whiteSpace: "nowrap",
        }}
      >
        {aviso}
      </div>

      <style>{`
        @keyframes cloud-drift {
          0%   { transform: translateX(0); }
          100% { transform: translateX(120vw); }
        }
      `}</style>
    </div>
  );
}

/** Tamaño del emoji por etapa: la planta crece de verdad al subir la racha. */
const PLANT_SIZE = [30, 38, 48, 60, 72];

type PlantProps = {
  habit: HabitWithStatus;
  soloLectura: boolean;
  agarrada: boolean;
  sitio: number;
  total: number;
  onAsaDown: (e: React.KeyboardEvent) => void;
  onArrastrar: (e: React.DragEvent) => void;
  onSoltarAsa: () => void;
};

function GardenPlant({
  habit,
  soloLectura,
  agarrada,
  sitio,
  total,
  onAsaDown,
  onArrastrar,
  onSoltarAsa,
}: PlantProps) {
  const [pending, startTransition] = useTransition();
  const sparkle = useSparkleBurst("spark");
  const drops = useSparkleBurst("drop");

  const stage = stageFor(habit.streak);
  const isWilted = isPlantWilted(
    habit.streak,
    habit.doneToday,
    habit.hasEverBeenDone,
  );
  const grid = spriteDe(
    habit.plantSpecies,
    stageFor(habit.streak),
    isPlantWilted(habit.streak, habit.doneToday, habit.hasEverBeenDone),
  );

  const estado = plantStateLabel(
    habit.streak,
    habit.doneToday,
    habit.hasEverBeenDone,
  );
  const thirsty = !habit.doneToday && !isWilted && habit.scheduledToday;
  const offDay = !habit.scheduledToday;
  const accent = habitColorVar(resolveHabitColor(habit.color));

  function handleWater() {
    /*
      `registradoHoy` y no `doneToday`: regar llama a `toggleToday`, que BORRA el
      registro si ya existe. Con un objetivo de 8 y 2 apuntados, `doneToday` es
      falso pero el registro está — y mirar `doneToday` haría que un clic aquí
      borrase esos 2 sin avisar.
    */
    if (soloLectura || habit.registradoHoy || !habit.scheduledToday || pending)
      return;
    drops.burst();
    sparkle.burst();
    startTransition(async () => {
      emitToggleResult(await toggleToday(habit.id, false));
    });
  }

  const situacion = soloLectura
    ? "así estaba ese día"
    : habit.registradoHoy && !habit.doneToday
      ? `apuntado ${habit.countToday ?? 0} de ${habit.targetCount}`
      : habit.doneToday
        ? "ya regada hoy"
        : offDay
          ? "hoy no toca"
          : "click para regar";

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        // Agarrada se nota SIN color: la planta se separa del suelo y se le
        // marca el contorno. El tono solo acompaña.
        transform: agarrada ? "translateY(-6px)" : undefined,
        outline: agarrada ? "3px dashed var(--color-tinta)" : undefined,
        outlineOffset: 4,
        transition: "transform 120ms",
      }}
    >
      {/*
        El asa va aparte del botón de regar a propósito. Si moviera desde la
        planta, arrastrarla un pelín al pulsar la regaría sin querer, y con
        teclado no habría forma de decir «mover» en vez de «regar».
      */}
      {soloLectura ? null : (
        <button
          type="button"
          draggable
          onDragStart={onArrastrar}
          onDragEnd={onSoltarAsa}
          onKeyDown={onAsaDown}
          onBlur={onSoltarAsa}
          aria-pressed={agarrada}
          aria-label={`Mover ${habit.name}, sitio ${sitio} de ${total}`}
          title={`Mover ${habit.name} — arrástrala, o Enter y las flechas`}
          style={{
            ...PEGATINA,
            position: "absolute",
            top: -6,
            left: -2,
            zIndex: 30,
            width: 22,
            height: 22,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "var(--radius-control)",
            fontSize: 12,
            lineHeight: 1,
            cursor: "grab",
          }}
        >
          <span aria-hidden>⠿</span>
        </button>
      )}

      <button
        type="button"
        onClick={handleWater}
        disabled={soloLectura || pending || habit.registradoHoy || offDay}
        title={`${habit.name} · ${estado} · racha de ${formatDays(habit.streak)} · ${situacion}`}
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
          background: "transparent",
          border: 0,
          padding: 0,
          fontFamily: "inherit",
          cursor: habit.registradoHoy || offDay ? "default" : "pointer",
        }}
      >
        {stage >= 3 && habit.doneToday ? (
          <span
            className="untap-pulse"
            aria-hidden
            style={{
              position: "absolute",
              top: 0,
              left: "50%",
              transform: "translate(-50%, -8px)",
              fontSize: 13,
              pointerEvents: "none",
              userSelect: "none",
            }}
          >
            <Sprite grid={DESTELLO} size={14} label="" />
          </span>
        ) : null}

        {habit.isAnchor ? (
          <span
            aria-hidden
            style={{
              position: "absolute",
              top: -8,
              right: 4,
              fontSize: 14,
              pointerEvents: "none",
              userSelect: "none",
              filter: "drop-shadow(0 0 4px rgba(245, 200, 158, 0.8))",
            }}
          >
            <Sprite grid={CORONA} size={14} label="" />
          </span>
        ) : null}

        <span
          className={habit.doneToday ? "untap-bobble" : undefined}
          aria-hidden
          style={{
            position: "relative",
            fontSize: PLANT_SIZE[stage],
            lineHeight: 1,
            userSelect: "none",
            opacity: offDay ? 0.35 : thirsty ? 0.55 : 1,
            filter: isWilted
              ? "saturate(0.4) brightness(0.8)"
              : habit.doneToday
                ? "drop-shadow(0 0 8px rgba(25, 158, 112, 0.5))"
                : "none",
            transition: "opacity 200ms",
          }}
        >
          {/* Vacío porque el `aria-label` lo pone el botón de fuera, que es lo que
            se pulsa: repetirlo aquí lo diría dos veces. */}
          <Sprite grid={grid} size={PLANT_SIZE[stage]} label="" />
          <SparkleLayer particles={sparkle.particles} />
          <SparkleLayer particles={drops.particles} />
        </span>

        <div
          aria-hidden
          style={{
            width: 72,
            height: 8,
            marginTop: 4,
            // Plana y con esquinas: sin radio y sin degradado.
            background: "#3b2a1a",
            border: "2px solid var(--color-line)",
          }}
        />

        <div
          style={{
            ...PEGATINA,
            marginTop: 6,
            maxWidth: "9rem",
            padding: "5px 8px",
            borderRadius: "var(--radius-control)",
            // El filo de color es identidad de hábito y sigue cumpliendo la misma
            // función que en la fila.
            borderLeft: `6px solid ${accent}`,
            textAlign: "left",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {habit.name}
          </div>
          {/* La racha es un dato: VT323 en su suelo de 16px. */}
          <div
            style={{
              fontFamily: "var(--font-vt)",
              fontSize: 16,
              lineHeight: 1.1,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {habit.streak} d · {estado}
          </div>
        </div>
      </button>
    </div>
  );
}
