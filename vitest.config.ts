import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    // Los tests tocan better-sqlite3 y node:crypto: entorno Node, no jsdom.
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
