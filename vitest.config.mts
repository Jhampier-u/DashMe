import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Los tests de fechas asumen un huso con offset negativo (el del usuario) para
// demostrar que el corte del día es local y no UTC.
process.env.TZ = "America/Lima";

export default defineConfig({
  // vitest no lee los `paths` de tsconfig. Sin este alias, cualquier test que
  // importe con `@/` falla al resolver el módulo.
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
