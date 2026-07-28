<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Reglas de este repo

## Fronteras entre módulos

`src/app/` solo enruta. Toda la lógica vive en `src/modules/<dominio>/`.

**Nada fuera de un módulo importa de su interior.** Se entra por
`src/modules/<dominio>/index.ts` y por ningún otro sitio. Si necesitas algo que
el `index.ts` no exporta, expórtalo ahí antes de usarlo — no atajes por
`lib/`.

`src/modules/core/` guarda lo compartido: la conexión a la base, `ui/` y
`shell/`. Algo sube a `core/` cuando un segundo módulo lo necesita de verdad, no
antes.

## Base de datos

Drizzle sobre SQLite, una sola conexión en `src/modules/core/db/`. Cada módulo
declara sus tablas en su propio `schema.ts` y `core/db/schema.ts` las compone.

Las funciones que tocan datos **reciben la base por parámetro** (`db: Db`). Eso
es lo que permite testearlas contra `createTestDb()`, una SQLite en memoria que
comparte el mismo `SCHEMA_SQL` que la real.

Los server actions son la excepción: se invocan desde el navegador, así que no
pueden recibir la conexión. Por eso la lógica vive en `lib/mutations.ts` (recibe
`db`) y `actions.ts` es solo el envoltorio `"use server"` que le inyecta el
singleton y llama a `refresh()`.

## Convenciones

- Tablas y columnas en `snake_case`; propiedades TypeScript en `camelCase`.
- Fechas como `integer({ mode: "timestamp_ms" })`, booleanos como
  `integer({ mode: "boolean" })`.
- Rutas en español.
- `legacy/` es la zona de aterrizaje de los repos absorbidos. Se vacía conforme
  avanzan los sub-proyectos y desaparecerá. No se compila ni se lintea.

## Documentación

- `docs/superpowers/specs/` y `docs/superpowers/plans/` — el diseño de la fusión.
- `docs/untap/` — el archivo de Untap: su README original, su backlog y sus 12
  documentos de diseño.
