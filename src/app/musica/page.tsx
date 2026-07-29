import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/modules/core/auth";
import { db } from "@/modules/core/db";
import {
  getMe,
  parseRange,
  resolveTimeZone,
  localParts,
  getTotals,
  getTopArtists,
  getTopTracks,
  getTopAlbums,
  getByHour,
  getByWeekday,
  getByMonth,
  getByDate,
  getStreaks,
  getSkipStats,
  getMostSkippedArtists,
  getGenreBreakdown,
  PROFUNDIDAD,
} from "@/modules/musica";
import TopBar from "@/modules/musica/components/TopBar";
import RangePicker from "@/modules/musica/components/stats/RangePicker";
import StatTiles from "@/modules/musica/components/stats/StatTiles";
import TopList from "@/modules/musica/components/stats/TopList";
import HourClock from "@/modules/musica/components/stats/HourClock";
import WeekdayBars from "@/modules/musica/components/stats/WeekdayBars";
import MonthlyChart from "@/modules/musica/components/stats/MonthlyChart";
import CalendarHeatmap from "@/modules/musica/components/stats/CalendarHeatmap";
import SkipPanel from "@/modules/musica/components/stats/SkipPanel";
import ShareCards from "@/modules/musica/components/stats/ShareCards";
import GenrePanel from "@/modules/musica/components/stats/GenrePanel";
import PlaylistFromTops from "@/modules/musica/components/stats/PlaylistFromTops";

export const dynamic = "force-dynamic";

/**
 * `Date.now()` es impuro; `react-hooks/purity` prohíbe llamarlo directamente
 * en el cuerpo de un componente. Se aísla aquí, igual que en
 * `src/components/CaptureHealth.tsx`.
 */
function ahoraMs(): number {
  return Date.now();
}

/** Minutos a "N h M min", o solo minutos si no llega a la hora. */
function duracion(ms: number): string {
  const minutos = Math.round(ms / 60000);
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  return `${horas.toLocaleString("es")} h ${minutos % 60} min`;
}

export default async function Portada({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string; desde?: string; hasta?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/musica/biblioteca");

  const params = await searchParams;
  const timeZone = resolveTimeZone(process.env);
  const ahora = ahoraMs();
  const range = parseRange(params, ahora, timeZone);
  const hoy = localParts(ahora, timeZone).localDate;

  const [
    me,
    totals,
    artistas,
    canciones,
    albumes,
    horas,
    semana,
    meses,
    dias,
    rachas,
    skips,
    masSaltados,
    generos,
  ] = await Promise.all([
    getMe(),
    getTotals(db, range),
    getTopArtists(db, range, "plays", 10),
    getTopTracks(db, range, "plays", 10),
    getTopAlbums(db, range, "plays", 10),
    getByHour(db, range),
    getByWeekday(db, range),
    getByMonth(db, range),
    getByDate(db, range),
    getStreaks(db, hoy),
    getSkipStats(db, range),
    getMostSkippedArtists(db, range),
    getGenreBreakdown(db, range),
  ]);

  const minutos = Math.round(totals.msTotal / 60000);
  const vacio = totals.reproducciones === 0;

  return (
    <main className="min-h-screen flex flex-col">
      <TopBar me={me} active="portada" />

      <section className="px-8 py-5 hairline-b">
        <RangePicker range={range} />
      </section>

      {/* ---------------- Cifra protagonista ---------------- */}
      <section className="px-8 pt-16 pb-12 hairline-b">
        <div className="grid grid-cols-12 gap-6 items-end">
          <div className="col-span-12 lg:col-span-7 fade-in">
            <p className="label-mono text-tinta mb-6">{range.label}</p>
            <p
              className="display num-tabular text-[clamp(4rem,15vw,12rem)] text-tinta leading-[0.82]"
              style={{ fontVariationSettings: '"opsz" 144, "SOFT" 0, "WONK" 1' }}
            >
              {minutos.toLocaleString("es")}
            </p>
            <p className="font-serif italic text-xl text-cream-dim mt-6">
              minutos de música
              {totals.diasActivos > 0 && (
                <> repartidos en {totals.diasActivos.toLocaleString("es")} días</>
              )}
            </p>
          </div>

          <div
            className="col-span-12 lg:col-span-5 flex justify-center lg:justify-end fade-in"
            style={{ animationDelay: "120ms" }}
          >
            <HourClock buckets={horas} />
          </div>
        </div>
      </section>

      {/* ---------------- Cifras secundarias ---------------- */}
      <section className="hairline-b">
        <StatTiles
          tiles={[
            {
              label: "Reproducciones",
              valor: totals.reproducciones.toLocaleString("es"),
            },
            {
              label: "Artistas",
              valor: totals.artistas.toLocaleString("es"),
              nota: `${totals.canciones.toLocaleString("es")} canciones`,
            },
            {
              label: "Racha actual",
              valor: `${rachas.actual}`,
              nota: `máxima ${rachas.maxima} días`,
              acento: rachas.actual > 0,
            },
            {
              label: "Tiempo total",
              valor: duracion(totals.msTotal),
              nota:
                totals.msTotal > 86_400_000
                  ? `${(totals.msTotal / 86_400_000).toFixed(1)} días seguidos`
                  : undefined,
            },
          ]}
        />
      </section>

      {vacio ? (
        <section className="px-8 py-24">
          <p className="font-serif italic text-2xl text-cream-dim max-w-xl leading-relaxed">
            Todavía no hay escuchas en este rango. La captura guarda lo que
            suene a partir de ahora; cuando importes tu histórico de Spotify
            aparecerá aquí todo lo anterior.
          </p>
        </section>
      ) : (
        <>
          {/* ---------------- Evolución ---------------- */}
          <section className="px-8 py-12 hairline-b fade-in">
            <MonthlyChart buckets={meses} />
          </section>

          {/* ---------------- Rankings ---------------- */}
          <section className="px-8 pt-12 pb-4 flex justify-end">
            <Link
              href="/musica/escucha/contraste"
              className="label-mono text-mute hover:underline transition-colors"
            >
              ¿Y qué cree Spotify? →
            </Link>
          </section>
          <section className="px-8 pb-12 hairline-b grid grid-cols-1 lg:grid-cols-3 gap-10">
            <TopList
              titulo="Artistas"
              entradas={artistas}
              vacio="Nada en este rango."
              hrefBase="/musica/escucha/artista"
            />
            <TopList
              titulo="Canciones"
              entradas={canciones}
              vacio="Nada en este rango."
              hrefBase="/musica/escucha/cancion"
            />
            <TopList
              titulo="Álbumes"
              entradas={albumes}
              vacio="Nada en este rango."
              hrefBase="/musica/escucha/album"
            />
          </section>

          {/* ---------------- Calendario ---------------- */}
          <section className="px-8 py-12 hairline-b fade-in">
            <CalendarHeatmap buckets={dias} />
          </section>

          {/* ---------------- Semana ---------------- */}
          <section className="px-8 py-12 hairline-b">
            <div className="max-w-2xl">
              <WeekdayBars buckets={semana} />
            </div>
          </section>

          {/* ---------------- Géneros ---------------- */}
          <section className="px-8 py-12 hairline-b fade-in">
            <GenrePanel
              generos={generos.generos}
              conGeneros={generos.conGeneros}
              sinGeneros={generos.sinGeneros}
              profundidad={PROFUNDIDAD}
              rangeParams={params}
            />
          </section>

          {/* ---------------- Compartir y exportar ---------------- */}
          <section className="px-8 py-12 hairline-b fade-in flex flex-col gap-12">
            <ShareCards range={range} />
            <PlaylistFromTops rangeParams={params} etiqueta={range.label} />
          </section>

          {/* ---------------- Abandono ---------------- */}
          {skips.conDatos > 0 && (
            <section className="px-8 py-12 hairline-b fade-in">
              <SkipPanel stats={skips} artistas={masSaltados} />
            </section>
          )}
        </>
      )}

      <footer className="hairline-b mt-auto" />
      <div className="px-8 py-5 flex items-center justify-between label-mono text-mute">
        <span>PORTADA</span>
        <span>{totals.reproducciones.toLocaleString("es")} REPRODUCCIONES</span>
      </div>
    </main>
  );
}
