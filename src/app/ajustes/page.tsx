import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { streams } from "@/db/schema";
import { getMe } from "@/lib/spotify";
import { getCaptureState } from "@/lib/capture/run-capture";
import TopBar from "@/components/TopBar";
import CaptureHealth from "@/components/CaptureHealth";

export const dynamic = "force-dynamic";

export default async function AjustesPage() {
  const session = await auth();
  if (!session) redirect("/");

  const [me, estado, conteo] = await Promise.all([
    getMe(),
    getCaptureState(),
    db.select({ n: sql<number>`count(*)` }).from(streams),
  ]);

  return (
    <main className="min-h-screen flex flex-col">
      <TopBar me={me} active="ajustes" />

      <section className="px-8 py-16 hairline-b">
        <p className="label-mono text-acid mb-6">Ajustes</p>
        <h1 className="display-italic text-[clamp(3rem,8vw,7rem)] leading-[0.9]">
          El taller.
        </h1>
      </section>

      <CaptureHealth
        lastRunAt={estado?.lastRunAt ?? null}
        lastRunStatus={estado?.lastRunStatus ?? null}
        lastRunInserted={estado?.lastRunInserted ?? null}
        lastError={estado?.lastError ?? null}
        gapSuspectedAt={estado?.gapSuspectedAt ?? null}
        totalStreams={conteo[0]?.n ?? 0}
      />

      <section className="px-8 py-10">
        <p className="label-mono text-mute mb-4">Zona horaria</p>
        <p className="font-serif italic text-lg text-cream-dim">
          STATS_TZ ={" "}
          <span className="font-mono not-italic">
            {process.env.STATS_TZ ?? "sin configurar"}
          </span>
        </p>
      </section>

      <footer className="hairline-b mt-auto" />
      <div className="px-8 py-5 flex items-center justify-between label-mono text-mute">
        <span>TALLER</span>
      </div>
    </main>
  );
}
