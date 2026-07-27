import { timingSafeEqual } from "node:crypto";
import { runCapture } from "@/lib/capture/run-capture";

/** Siempre dinámico: nunca debe servirse una respuesta cacheada. */
export const dynamic = "force-dynamic";

/**
 * Comparación en tiempo constante. La comprobación de longitud previa filtra
 * información, pero `timingSafeEqual` exige buffers del mismo tamaño y la
 * longitud de un secreto no es el dato sensible.
 */
function secretoValido(recibido: string | null, esperado: string): boolean {
  if (!recibido) return false;
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const esperado = process.env.CRON_SECRET;

  if (!esperado) {
    return Response.json(
      { error: "CRON_SECRET no está configurado en el servidor." },
      { status: 500 },
    );
  }

  if (!secretoValido(request.headers.get("x-cron-secret"), esperado)) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const resultado = await runCapture(false);

  // El cron debe poder distinguir un fallo, así que un error va con 500 aunque
  // la ejecución en sí no haya lanzado.
  const status = resultado.status === "error" ? 500 : 200;
  return Response.json(resultado, { status });
}
