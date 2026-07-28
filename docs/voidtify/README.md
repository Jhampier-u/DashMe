# Archivo de Voidtify

Voidtify —*Ledger*— era una aplicación independiente
([github.com/Jhampier-u/Voidtify](https://github.com/Jhampier-u/Voidtify)) antes de
fusionarse en este dashboard. Su código vive ahora en `src/modules/musica/` y sus
rutas están bajo `/musica/`.

Esta carpeta conserva lo que no era código pero sí valía:

- **`README-original.md`** — la descripción completa: tags personalizados, detector de
  duplicados, smart playlists, importador del volcado extendido de Spotify, y el
  sistema de estadísticas sobre el historial de escucha.
- **`AUDITORIA.md`** — auditoría del proyecto.
- **`specs/`** y **`plans/`** — los documentos de diseño de la captura de
  reproducciones, el importador y el sistema de estadísticas. Explican decisiones que
  el código no cuenta.

## Dos cosas que dependen de archivos concretos

**`public/fonts/Fraunces.ttf` y `JetBrainsMono.ttf`** no son decorativos: la ruta
`/api/card/[tipo]` los lee **en tiempo de ejecución** para generar tarjetas. Esa API
solo admite ttf, otf o woff, y `next/font` genera woff2 — de ahí la copia. Borrarlos
rompe la generación de tarjetas sin que falle ni el build ni ningún test.

**`scripts/capture.cmd`** dispara la captura de reproducciones contra
`/api/cron/capture`. Lee `CRON_SECRET` de `.env.local` para que el secreto no aparezca
en la definición de la tarea programada de Windows.

## Los datos

El historial de escucha —271.769 reproducciones de 2018 a 2026— se importó del volcado
GDPR de Spotify y **no se puede recuperar por API**. Vivía en `C:\Voidtify\data\ledger.db`.

La historia de commits de Voidtify está en este mismo repo: entró con `git subtree` y
sus commits son alcanzables por SHA.
