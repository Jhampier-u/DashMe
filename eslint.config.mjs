import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Zona de aterrizaje de los repos absorbidos: código todavía sin migrar,
    // se vacía conforme avanzan los sub-proyectos. Desaparece con ella.
    "legacy/**",
  ]),
]);

export default eslintConfig;
