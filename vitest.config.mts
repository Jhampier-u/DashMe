import { defineConfig } from "vitest/config";

// Los tests de fechas asumen un huso con offset negativo (el del usuario) para
// demostrar que el corte del día es local y no UTC.
process.env.TZ = "America/Lima";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
