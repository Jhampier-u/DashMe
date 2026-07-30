import { Card } from "@/modules/core/ui/Card";
import type { Comparacion } from "@/modules/core/analisis/comparar-dias";

const ROTULO = "block text-xs font-semibold text-tinta font-cuerpo mb-1.5";

function minutos(ms: number | null): string {
  if (ms === null) return "—";
  const m = Math.round(ms / 60_000);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

/**
 * Los días que cumples frente a los que no, en minutos de música.
 *
 * NO AFIRMA CAUSALIDAD, y eso es una decisión del diseño, no un descuido de
 * redacción. Es una correlación sobre dos grupos de diez días: no distingue causa
 * de casualidad. Sin flechas, sin «mejor» ni «peor», sin consejos.
 *
 * Vive en `habitos/components/home/` como compromiso: su texto menciona los dos
 * dominios, así que estrictamente no es de ninguno, pero no importa nada de
 * música —solo el tipo `Comparacion` de `core`— y la portada se ensambla con los
 * componentes de esta carpeta. Inventarle una tercera casa a un solo componente
 * sería peor.
 */
export function MusicaPanel({ c }: { c: Comparacion }) {
  return (
    <Card>
      <span className={ROTULO}>Música y hábitos</span>

      {!c.suficiente ? (
        <p style={{ fontSize: 13 }}>
          Todavía no hay bastante para comparar.
          {c.faltanA > 0 ? ` Faltan ${c.faltanA} días cumpliendo todo` : ""}
          {c.faltanA > 0 && c.faltanB > 0 ? " y" : ""}
          {c.faltanB > 0 ? ` ${c.faltanB} días sin cumplirlo todo` : ""}.
        </p>
      ) : (
        <>
          <p style={{ fontSize: 13 }}>
            Los días que cumples todo escuchas{" "}
            <strong>{minutos(c.medianaA)}</strong> de música. Los días que no,{" "}
            <strong>{minutos(c.medianaB)}</strong>.
          </p>
          {/*
            Esta frase es un criterio de aceptación, no un adorno: en cuanto se
            pinta un número, se lee como causa. No la quites ni la suavices.
          */}
          <p style={{ fontSize: 11.5, marginTop: 6 }}>
            Medianas sobre {c.nA} días cumplidos y {c.nB} sin cumplir. Es una
            coincidencia en tus datos, no una causa.
          </p>
        </>
      )}
    </Card>
  );
}
