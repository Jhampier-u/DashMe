import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 es un módulo nativo: nunca debe entrar en el bundle del
  // servidor, hay que cargarlo con require en tiempo de ejecución.
  serverExternalPackages: ["better-sqlite3"],

  experimental: {
    serverActions: {
      /*
        51 y no 50, que es el tope por archivo de `lib/adjuntos-ruta.ts`.

        La diferencia es para los bordes, cabeceras de parte y metadatos que
        añade `multipart/form-data`, que la documentación de Next cifra en 10–20
        KB. Apurar el límite exacto rompería justo en los archivos grandes, que
        son los que más cuesta volver a subir.

        Sin esto el tope serían 1 MB, el de por defecto, y adjuntar cualquier
        foto de móvil fallaría.
      */
      bodySizeLimit: "51mb",
    },
  },
};

export default nextConfig;
