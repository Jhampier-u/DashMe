import { db } from "@/modules/core/db";
import { exportarTodo } from "@/modules/habitos";

/*
  Descarga TODO lo guardado, en JSON.

  Es una ruta y no un server action porque lo que queremos es un fichero: un
  action devuelve datos al navegador y habría que montar el Blob a mano, con lo
  que el enlace dejaría de ser un enlace —abrir en otra pestaña, copiar,
  `curl`— y pasaría a depender de que el JavaScript de la página funcione.

  Sin autenticación, como el resto del dashboard: esto corre en 127.0.0.1 y
  contra tu propio disco. Si algún día escuchara en una red, esta ruta es la
  primera que hay que cerrar, porque se lleva la base entera.
*/
export async function GET() {
  const datos = await exportarTodo(db);
  const fecha = datos.generado.slice(0, 10);
  return new Response(JSON.stringify(datos, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="dashme-${fecha}.json"`,
      // Un volcado caducado sería peor que ninguno.
      "cache-control": "no-store",
    },
  });
}
