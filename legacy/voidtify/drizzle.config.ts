import { defineConfig } from "drizzle-kit";

// Tooling de migraciones. La app sigue auto-creando las tablas al arrancar
// (`src/db/index.ts`) como red de seguridad, pero a partir de aquí los cambios
// de esquema deberían pasar por migraciones versionadas:
//   npm run db:generate   # genera SQL en ./drizzle a partir de schema.ts
//   npm run db:migrate    # aplica las migraciones pendientes
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: "./data/ledger.db" },
});
