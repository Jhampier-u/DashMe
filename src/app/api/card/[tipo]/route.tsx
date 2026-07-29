import fs from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { auth } from "@/modules/core/auth";
import { db } from "@/modules/core/db";
import {
  parseRange,
  resolveTimeZone,
  localParts,
  getTotals,
  getTopArtists,
  getStreaks,
} from "@/modules/musica";

export const dynamic = "force-dynamic";

const ANCHO = 1080;
const ALTO = 1920;

/*
  La paleta del sistema pixel, escrita a mano.

  Aquí no valen las variables CSS: `ImageResponse` renderiza con satori fuera
  del navegador, así que no hay `:root` del que leer. Es una copia y hay que
  saberlo: si la paleta cambia, este archivo no se entera solo.

  Los nombres son los del sistema, no los del mundo editorial anterior.
*/
const PAPEL = "#fff5fb";
const TINTA = "#4a3a52";
const ROSA = "#ff9ec7";

/*
  `ACID` servía dos papeles: relleno una vez y color de texto cinco. Sobre
  papel, el rosa como texto da 1,42:1 —invisible— así que solo se queda donde
  rellena. Lo que era acento de texto pasa a tinta con más grosor, igual que en
  el resto del dashboard.
*/
const INK = PAPEL;
const CREAM = TINTA;
const CREAM_DIM = TINTA;
const MUTE = TINTA;
const RULE = TINTA;
const ACID = ROSA;

const TIPOS = ["resumen", "top-artistas", "racha"] as const;
type Tipo = (typeof TIPOS)[number];

/**
 * Las fuentes se leen del disco, no del CSS.
 *
 * `ImageResponse` renderiza fuera del navegador: no hay hoja de estilos ni
 * `next/font` que valga, solo búferes. Y solo admite ttf, otf o woff — los
 * woff2 que genera `next/font` no sirven, de ahí la copia en `public/fonts`.
 *
 * Se cachean en memoria: leer 500 KB de disco en cada petición sería tonto.
 */
let fuentesCache: { pixel: Buffer; cuerpo: Buffer } | null = null;

async function fuentes() {
  if (fuentesCache) return fuentesCache;
  const dir = path.join(process.cwd(), "public", "fonts");
  const [pixel, cuerpo] = await Promise.all([
    fs.readFile(path.join(dir, "PressStart2P-Regular.ttf")),
    fs.readFile(path.join(dir, "Quicksand-Bold.ttf")),
  ]);
  fuentesCache = { pixel, cuerpo };
  return fuentesCache;
}

function esTipo(v: string): v is Tipo {
  return (TIPOS as readonly string[]).includes(v);
}

/* ------------------------------------------------------------------ */

function Marco({
  etiqueta,
  pie,
  children,
}: {
  etiqueta: string;
  pie: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        width: ANCHO,
        height: ALTO,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: INK,
        color: CREAM,
        padding: 90,
        fontFamily: "Pixel",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span
          style={{
            fontFamily: "Cuerpo",
            fontSize: 26,
            letterSpacing: 4,
            color: TINTA,
          }}
        >
          {etiqueta.toUpperCase()}
        </span>
        <span
          style={{
            fontFamily: "Cuerpo",
            fontSize: 26,
            letterSpacing: 4,
            color: MUTE,
          }}
        >
          VOIDTIFY
        </span>
      </div>

      {children}

      <div
        style={{
          display: "flex",
          borderTop: `2px solid ${RULE}`,
          paddingTop: 28,
          fontFamily: "Cuerpo",
          fontSize: 24,
          letterSpacing: 3,
          color: MUTE,
        }}
      >
        {pie.toUpperCase()}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tipo: string }> },
) {
  const session = await auth();
  if (!session) return new Response("No autorizado", { status: 401 });

  const { tipo } = await params;
  if (!esTipo(tipo)) return new Response("Tipo desconocido", { status: 404 });

  const url = new URL(request.url);
  const timeZone = resolveTimeZone(process.env);
  const ahora = Date.now();
  const range = parseRange(
    {
      preset: url.searchParams.get("preset") ?? undefined,
      desde: url.searchParams.get("desde") ?? undefined,
      hasta: url.searchParams.get("hasta") ?? undefined,
    },
    ahora,
    timeZone,
  );

  const { pixel, cuerpo } = await fuentes();
  const opciones = {
    width: ANCHO,
    height: ALTO,
    fonts: [
      { name: "Pixel", data: pixel, weight: 400 as const, style: "normal" as const },
      { name: "Cuerpo", data: cuerpo, weight: 700 as const, style: "normal" as const },
    ],
  };

  if (tipo === "resumen") {
    const [totals, top] = await Promise.all([
      getTotals(db, range),
      getTopArtists(db, range, "plays", 1),
    ]);
    const horas = Math.round(totals.msTotal / 3_600_000);

    return new ImageResponse(
      (
        <Marco etiqueta={range.label} pie={`${range.fromDate} — ${range.toDate}`}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {/* 200 y no 300: Pixel es monoespaciada a 1em, así que una cifra de
                cuatro dígitos ocupa 4× el tamaño. La tarjeta mide 1080 y quedan
                920 útiles tras los márgenes. */}
            <span style={{ fontSize: 200, color: TINTA, lineHeight: 1.2 }}>
              {horas.toLocaleString("es")}
            </span>
            <span style={{ fontFamily: "Cuerpo", fontSize: 46, color: CREAM_DIM, marginTop: 16 }}>
              horas de música
            </span>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                marginTop: 90,
                borderTop: `2px solid ${RULE}`,
                paddingTop: 40,
              }}
            >
              <span style={{ fontSize: 44, color: MUTE }}>
                {totals.reproducciones.toLocaleString("es")} reproducciones
              </span>
              <span style={{ fontSize: 44, color: MUTE, marginTop: 14 }}>
                {totals.artistas.toLocaleString("es")} artistas
              </span>
              {top[0] && (
                <span style={{ fontSize: 44, color: CREAM, marginTop: 30 }}>
                  sobre todo {top[0].name}
                </span>
              )}
            </div>
          </div>
        </Marco>
      ),
      opciones,
    );
  }

  if (tipo === "top-artistas") {
    const top = await getTopArtists(db, range, "plays", 5);
    const max = Math.max(1, ...top.map((a) => a.plays));

    return new ImageResponse(
      (
        <Marco etiqueta={range.label} pie="mis artistas">
          <div style={{ display: "flex", flexDirection: "column" }}>
            {top.map((a, i) => (
              <div
                key={a.key}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  marginBottom: 46,
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline" }}>
                  <span
                    style={{
                      fontFamily: "Cuerpo",
                      fontSize: 40,
                      // Tinta siempre: el rosa como texto sobre papel da
                      // 1,42:1. Lo que marca al primero es el grosor.
                      color: TINTA,
                      fontWeight: i === 0 ? 700 : 400,
                      width: 90,
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    style={{
                      // Quicksand y no la pixelada: son nombres, no títulos,
                      // y en monoespaciada uno largo se saldría de la tarjeta.
                      fontFamily: "Cuerpo",
                      fontSize: i === 0 ? 68 : 52,
                      color: TINTA,
                      fontWeight: i === 0 ? 700 : 400,
                    }}
                  >
                    {a.name}
                  </span>
                </div>
                <div style={{ display: "flex", marginLeft: 90, marginTop: 12 }}>
                  <div
                    style={{
                      display: "flex",
                      width: (a.plays / max) * 700,
                      height: 8,
                      backgroundColor: i === 0 ? ACID : RULE,
                    }}
                  />
                  <span
                    style={{
                      fontFamily: "Cuerpo",
                      fontSize: 28,
                      color: MUTE,
                      marginLeft: 20,
                    }}
                  >
                    {a.plays.toLocaleString("es")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Marco>
      ),
      opciones,
    );
  }

  // racha
  const hoy = localParts(ahora, timeZone).localDate;
  const rachas = await getStreaks(db, hoy);

  return new ImageResponse(
    (
      <Marco etiqueta="racha" pie={`máxima ${rachas.maxima} días`}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 200, color: TINTA, lineHeight: 1.2 }}>
            {rachas.actual}
          </span>
          <span style={{ fontFamily: "Cuerpo", fontSize: 46, color: CREAM_DIM, marginTop: 16 }}>
            {rachas.actual === 1 ? "día seguido" : "días seguidos"} con música
          </span>
          {rachas.maximaDesde && (
            <span
              style={{
                fontFamily: "Cuerpo",
                fontSize: 32,
                color: MUTE,
                marginTop: 70,
              }}
            >
              tu récord: {rachas.maxima} días desde {rachas.maximaDesde}
            </span>
          )}
        </div>
      </Marco>
    ),
    opciones,
  );
}
