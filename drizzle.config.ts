import { defineConfig } from "drizzle-kit";

// Tooling de migraciones. La app auto-crea las tablas al arrancar
// (`src/modules/core/db/index.ts`) como red de seguridad, pero a partir de aquí
// los cambios de esquema deberían pasar por migraciones versionadas:
//   npm run db:generate   # genera SQL en ./drizzle a partir del esquema
//   npm run db:migrate    # aplica las migraciones pendientes
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/modules/core/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: "./data/juampi.db" },
});
