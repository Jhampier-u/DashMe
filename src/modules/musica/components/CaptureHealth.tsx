"use client";

import { useState, useTransition } from "react";
import { capturarAhora } from "@/modules/musica/lib/capture-actions";
import type { CaptureResult } from "@/modules/musica/lib/capture/run-capture";

export type CaptureHealthProps = {
  lastRunAt: number | null;
  lastRunStatus: string | null;
  lastRunInserted: number | null;
  lastError: string | null;
  gapSuspectedAt: number | null;
  totalStreams: number;
};

/** Umbral a partir del cual se considera que el cron dejó de correr. */
const HORAS_PARA_ALERTA = 2;

function haceCuanto(ts: number | null): string {
  if (!ts) return "nunca";
  const minutos = Math.floor((Date.now() - ts) / 60_000);
  if (minutos < 1) return "hace menos de un minuto";
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  return `hace ${Math.floor(horas / 24)} días`;
}

function esDesatendido(lastRunAt: number | null): boolean {
  return (
    !lastRunAt ||
    Date.now() - lastRunAt > HORAS_PARA_ALERTA * 60 * 60 * 1000
  );
}

export default function CaptureHealth(props: CaptureHealthProps) {
  const [pendiente, startTransition] = useTransition();
  const [resultado, setResultado] = useState<CaptureResult | null>(null);

  const desatendido = esDesatendido(props.lastRunAt);

  const ejecutar = () => {
    startTransition(async () => {
      setResultado(await capturarAhora());
    });
  };

  return (
    <section className="hairline-b px-8 py-10">
      <p className="label-mono text-mute mb-6">Captura en segundo plano</p>

      {desatendido && (
        <p className="label-mono text-blood mb-6">
          ⚠ La captura no se ejecuta desde {haceCuanto(props.lastRunAt)}. Si la
          tarea programada está activa, revisa el último error.
        </p>
      )}

      {props.gapSuspectedAt && (
        <p className="label-mono text-blood mb-6">
          ⚠ Posible hueco detectado {haceCuanto(props.gapSuspectedAt)}: llegaron
          50 escuchas nuevas de golpe, así que puede que se perdieran algunas
          entre dos ejecuciones.
        </p>
      )}

      <dl className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div>
          <dt className="label-mono text-mute">Escuchas capturadas</dt>
          <dd className="num-tabular text-2xl">
            {props.totalStreams.toLocaleString("es")}
          </dd>
        </div>
        <div>
          <dt className="label-mono text-mute">Última ejecución</dt>
          <dd className="num-tabular text-2xl">{haceCuanto(props.lastRunAt)}</dd>
        </div>
        <div>
          <dt className="label-mono text-mute">Estado</dt>
          <dd className="num-tabular text-2xl">{props.lastRunStatus ?? "—"}</dd>
        </div>
        <div>
          <dt className="label-mono text-mute">Insertadas</dt>
          <dd className="num-tabular text-2xl">{props.lastRunInserted ?? 0}</dd>
        </div>
      </dl>

      {props.lastError && (
        <p className="label-mono text-blood mb-6 break-all">
          Último error: {props.lastError}
        </p>
      )}

      <button
        type="button"
        onClick={ejecutar}
        disabled={pendiente}
        className="label-mono border border-current px-4 py-2 disabled:opacity-50"
      >
        {pendiente ? "Capturando…" : "Ejecutar ahora"}
      </button>

      {resultado && (
        <p className="label-mono text-mute mt-4">
          {resultado.status} · {resultado.fetched} leídas ·{" "}
          {resultado.inserted} nuevas
          {resultado.message ? ` · ${resultado.message}` : ""}
        </p>
      )}
    </section>
  );
}
