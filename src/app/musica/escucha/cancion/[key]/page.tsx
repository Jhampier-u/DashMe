import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/modules/core/auth";
import { db } from "@/modules/core/db";
import { getMe } from "@/modules/musica/lib/spotify";
import { parseRange } from "@/modules/musica/lib/stats/range";
import { resolveTimeZone } from "@/modules/musica/lib/stats/local-time";
import { getTrackDetail } from "@/modules/musica/lib/stats/detail";
import TopBar from "@/modules/musica/components/TopBar";
import RangePicker from "@/modules/musica/components/stats/RangePicker";
import EntityHeader from "@/modules/musica/components/stats/EntityHeader";
import MonthlyChart from "@/modules/musica/components/stats/MonthlyChart";

export const dynamic = "force-dynamic";

function ahoraMs(): number {
  return Date.now();
}

function fecha(ms: number): string {
  return new Date(ms).toLocaleDateString("es", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: process.env.STATS_TZ,
  });
}

export default async function FichaCancion({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ preset?: string; desde?: string; hasta?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/musica/biblioteca");

  const { key } = await params;
  const sp = await searchParams;
  const range = parseRange(sp, ahoraMs(), resolveTimeZone(process.env));

  const [me, ficha] = await Promise.all([
    getMe(),
    getTrackDetail(db, range, decodeURIComponent(key)),
  ]);

  if (!ficha) notFound();

  const horas = ficha.ms / 3_600_000;

  return (
    <main className="min-h-screen flex flex-col">
      <TopBar me={me} active="portada" />

      <section className="px-8 py-5 hairline-b flex items-center justify-between gap-4 flex-wrap">
        <RangePicker range={range} base={`/musica/escucha/cancion/${key}`} />
        <Link href="/musica" className="label-mono text-mute hover:text-acid transition-colors">
          ← Portada
        </Link>
      </section>

      <EntityHeader
        posicion={ficha.posicion}
        contexto={range.label}
        titulo={ficha.name}
        subtitulo={ficha.artistName}
        subtituloHref={`/musica/escucha/artista/${encodeURIComponent(ficha.artistKey)}`}
        tiles={[
          { label: "Reproducciones", valor: ficha.plays.toLocaleString("es") },
          {
            label: "Tiempo",
            valor:
              horas >= 1
                ? `${horas.toFixed(1)} h`
                : `${Math.round(ficha.ms / 60000).toLocaleString("es")} min`,
          },
          { label: "Primera vez", valor: fecha(ficha.primeraVez) },
          { label: "Última vez", valor: fecha(ficha.ultimaVez) },
        ]}
      />

      <section className="px-8 py-12 fade-in">
        <MonthlyChart
          buckets={ficha.porMes.map((m) => ({ ...m, ms: 0 }))}
        />
      </section>

      <footer className="hairline-b mt-auto" />
      <div className="px-8 py-5 flex items-center justify-between label-mono text-mute">
        <span>CANCIÓN</span>
        <span>{ficha.plays.toLocaleString("es")} REPRODUCCIONES</span>
      </div>
    </main>
  );
}
