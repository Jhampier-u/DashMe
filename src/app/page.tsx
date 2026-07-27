import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db";
import { getMe } from "@/lib/spotify";
import { parseRange } from "@/lib/stats/range";
import { resolveTimeZone, localParts } from "@/lib/stats/local-time";
import { getTotals } from "@/lib/stats/totals";
import { getTopArtists, getTopTracks } from "@/lib/stats/tops";
import { getByHour } from "@/lib/stats/time";
import { getStreaks } from "@/lib/stats/streaks";
import TopBar from "@/components/TopBar";
import RangePicker from "@/components/stats/RangePicker";
import TopList from "@/components/stats/TopList";
import HourHistogram from "@/components/stats/HourHistogram";

export const dynamic = "force-dynamic";

/**
 * `Date.now()` es impuro; `react-hooks/purity` prohíbe llamarlo directamente
 * en el cuerpo de un componente. Se aísla aquí, igual que en
 * `src/components/CaptureHealth.tsx`.
 */
function ahoraMs(): number {
  return Date.now();
}

export default async function Portada({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string; desde?: string; hasta?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/biblioteca");

  const params = await searchParams;
  const timeZone = resolveTimeZone(process.env);
  const ahora = ahoraMs();
  const range = parseRange(params, ahora, timeZone);
  const hoy = localParts(ahora, timeZone).localDate;

  const [me, totals, artistas, canciones, horas, rachas] = await Promise.all([
    getMe(),
    getTotals(db, range),
    getTopArtists(db, range, "plays", 10),
    getTopTracks(db, range, "plays", 10),
    getByHour(db, range),
    getStreaks(db, hoy),
  ]);

  const minutos = Math.round(totals.msTotal / 60000);

  return (
    <main className="min-h-screen flex flex-col">
      <TopBar me={me} active="portada" />

      <section className="px-8 py-6 hairline-b">
        <RangePicker range={range} />
      </section>

      <section className="px-8 py-16 hairline-b">
        <p className="label-mono text-acid mb-6">{range.label}</p>
        <p
          className="display num-tabular text-[clamp(3.5rem,14vw,11rem)] text-acid leading-none"
          style={{ fontVariationSettings: '"opsz" 144, "SOFT" 0, "WONK" 1' }}
        >
          {minutos.toLocaleString("es")}
        </p>
        <p className="font-serif italic text-lg text-cream-dim mt-4">
          minutos · {totals.reproducciones.toLocaleString("es")} reproducciones ·{" "}
          {totals.artistas.toLocaleString("es")} artistas ·{" "}
          {totals.diasActivos.toLocaleString("es")} días con música
        </p>
        {rachas.actual > 0 && (
          <p className="label-mono text-mute mt-4">
            Racha actual: {rachas.actual} días · Máxima: {rachas.maxima}
          </p>
        )}
      </section>

      {totals.reproducciones === 0 ? (
        <section className="px-8 py-16">
          <p className="font-serif italic text-xl text-cream-dim max-w-lg">
            Todavía no hay escuchas en este rango. La captura guarda lo que
            suene a partir de ahora; cuando importes tu histórico de Spotify
            aparecerá aquí todo lo anterior.
          </p>
        </section>
      ) : (
        <>
          <section className="px-8 py-12 hairline-b grid grid-cols-1 lg:grid-cols-2 gap-12">
            <TopList
              titulo="Artistas"
              entradas={artistas}
              vacio="Nada en este rango."
            />
            <TopList
              titulo="Canciones"
              entradas={canciones}
              vacio="Nada en este rango."
            />
          </section>

          <section className="px-8 py-12 hairline-b">
            <HourHistogram buckets={horas} />
          </section>
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
