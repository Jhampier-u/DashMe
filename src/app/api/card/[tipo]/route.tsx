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

const INK = "#0c0a09";
const CREAM = "#f4ede4";
const CREAM_DIM = "#c4bdb2";
const MUTE = "#6b6358";
const RULE = "#2a2521";
const ACID = "#d2ff3a";

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
let fuentesCache: { serif: Buffer; mono: Buffer } | null = null;

async function fuentes() {
  if (fuentesCache) return fuentesCache;
  const dir = path.join(process.cwd(), "public", "fonts");
  const [serif, mono] = await Promise.all([
    fs.readFile(path.join(dir, "Fraunces.ttf")),
    fs.readFile(path.join(dir, "JetBrainsMono.ttf")),
  ]);
  fuentesCache = { serif, mono };
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
        fontFamily: "Fraunces",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span
          style={{
            fontFamily: "JetBrains",
            fontSize: 26,
            letterSpacing: 4,
            color: ACID,
          }}
        >
          {etiqueta.toUpperCase()}
        </span>
        <span
          style={{
            fontFamily: "JetBrains",
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
          fontFamily: "JetBrains",
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

  const { serif, mono } = await fuentes();
  const opciones = {
    width: ANCHO,
    height: ALTO,
    fonts: [
      { name: "Fraunces", data: serif, weight: 400 as const, style: "normal" as const },
      { name: "JetBrains", data: mono, weight: 400 as const, style: "normal" as const },
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
            <span style={{ fontSize: 300, color: ACID, lineHeight: 1 }}>
              {horas.toLocaleString("es")}
            </span>
            <span style={{ fontSize: 58, color: CREAM_DIM, marginTop: 10 }}>
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
                      fontFamily: "JetBrains",
                      fontSize: 40,
                      color: i === 0 ? ACID : MUTE,
                      width: 90,
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    style={{
                      fontSize: i === 0 ? 82 : 62,
                      color: i === 0 ? ACID : CREAM,
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
                      fontFamily: "JetBrains",
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
          <span style={{ fontSize: 340, color: ACID, lineHeight: 1 }}>
            {rachas.actual}
          </span>
          <span style={{ fontSize: 58, color: CREAM_DIM, marginTop: 10 }}>
            {rachas.actual === 1 ? "día seguido" : "días seguidos"} con música
          </span>
          {rachas.maximaDesde && (
            <span
              style={{
                fontFamily: "JetBrains",
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
