import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 es un módulo nativo: nunca debe entrar en el bundle del
  // servidor, hay que cargarlo con require en tiempo de ejecución.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
