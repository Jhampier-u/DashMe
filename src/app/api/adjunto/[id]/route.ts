import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { db } from "@/modules/core/db";
import { taskAttachments } from "@/modules/habitos/schema";
import { rutaDeAdjunto } from "@/modules/habitos/lib/adjuntos-ruta";

/*
  Sirve un adjunto.

  RECIBE UN ID DE FILA, NUNCA UNA RUTA. El nombre en disco sale de la base y no
  de la URL. Si aceptara un nombre de la URL,
  `/api/adjunto/../../data/juampi.db` descargaría la base entera, con el
  histórico de música y todo lo demás.

  Y aunque el nombre venga de la base, `rutaDeAdjunto` vuelve a comprobar que
  tiene forma de UUID y que la ruta cae dentro de la carpeta. Es un cinturón
  sobre el tirante: una fila corrupta tampoco puede salirse.
*/
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const [a] = await db
    .select()
    .from(taskAttachments)
    .where(eq(taskAttachments.id, id))
    .limit(1);

  if (!a || a.kind !== "file" || !a.storedAs) {
    return new Response("No encontrado", { status: 404 });
  }

  const ruta = rutaDeAdjunto(a.storedAs);
  if (!ruta) return new Response("No encontrado", { status: 404 });

  let bytes: Buffer;
  try {
    bytes = await readFile(ruta);
  } catch {
    // El archivo se borró por debajo. La fila sigue: se responde 404 y la
    // pantalla lo cuenta, en vez de reventar.
    return new Response("El archivo ya no está", { status: 404 });
  }

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": a.mime ?? "application/octet-stream",
      /*
        `attachment` y NUNCA `inline`. Servir un HTML o un SVG subido por el
        usuario en el mismo origen que la aplicación es un agujero de script;
        forzar la descarga lo cierra.

        Se quitan las comillas y los saltos del nombre, que romperían la
        cabecera y permitirían inyectar otras.
      */
      "Content-Disposition": `attachment; filename="${a.name.replace(/["\r\n]/g, "")}"`,
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, no-store",
    },
  });
}
