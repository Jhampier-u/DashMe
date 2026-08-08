# Dónde está el proyecto

Actualizado: 8 de agosto de 2026 · `main` sincronizado con el remoto.

Este archivo existe para que retomar no dependa de la memoria de nadie. Los dos
documentos largos son [la auditoría](auditoria-2026-08-07.md) y
[la propuesta](propuesta-2026-08-08.md).

## Música salió del dashboard

8 de agosto de 2026. Vuelve a ser una app aparte; puede que algún día regrese.

**Tus datos no se tocaron.** Siguen en la base las **272.395 filas de `streams`**
y las once tablas restantes (`artists`, `tags`, `track_tags`, `liked_tracks`,
`smart_playlists`, `spotify_credentials`, `capture_state`, `import_batches`,
`artist_resolution`, `top_snapshots`, `artist_genres`). Cada sentencia del
esquema era `CREATE TABLE IF NOT EXISTS`, así que quitarlas solo hace que una
base **nueva** no las cree. No se ejecutó ningún `DROP` en ningún paso.

**Qué se retiró:** `src/modules/musica/`, `src/app/musica/`, las rutas
`api/card`, `api/cron` y `api/auth`, `src/modules/core/auth/` entera (solo
existía para Spotify), el icono y la entrada de navegación, el bloque de música
del esquema, la sección de la portada, la dependencia `next-auth`,
`.env.local.example` (era todo variables de Spotify), `scripts/capture.cmd`,
`scripts/migrar-ledger.mjs` y 23 ficheros de test.

**Cómo vuelve:** todo está en la etiqueta `musica-antes-de-salir`.

**Te queda una cosa por hacer a ti.** La tarea programada **«Juampi captura»**
sigue instalada en Windows y cada 20 minutos llamaría a un endpoint que ya no
existe. El instalador ya no la crea y la retira si la encuentra, pero yo no
toco el Programador de tareas:

```
schtasks /End /TN "Juampi captura" & schtasks /Delete /TN "Juampi captura" /F
```

## Hecho

| Sección | Estado |
|---|---|
| **Jardín** | Rediseño completo (pixel art, huecos, memoria, tienda) + plantas en el suelo, cielo de un tono, fauna honesta |
| **Hábitos** | Hallazgos 1 y 2, bonus por volver, racha que perdona un fallo, intención a la vista y editable, estado «interiorizado» |
| **Tareas** | Hallazgos 3 y 4, barra de filtros por grupos con recuentos y chips activos, bolita de estado en las tarjetas |
| **Inicio** | Arreglada de rebote por los hallazgos 1 y 2; sin panel de música |
| **Proyectos** | Auditado en su lógica de datos. **Su interfaz no se ha revisado** |

## Pendiente, en orden

1. **Proyectos, pasada de interfaz.** `AdvancePanel`, `NewProjectForm`,
   `ProjectCard`, `ProjectsHeader` sin revisar, y sin verificación en navegador.
2. **El SRBAI** (propuesta 6.1): cuatro preguntas semanales que midan
   automaticidad y **sugieran** el estado «interiorizado», que ya existe.
3. **La memoria de UbiFit** (propuesta 3.3): mariposa grande esta semana,
   pequeñas las tres anteriores.
4. **La exportación honesta** (propuesta 5.3).

## Decisiones tuyas, sin resolver

- **El repositorio es público** y dos planes de `docs/superpowers/plans/` nombran
  tus hábitos reales.
- **Tres dudas de los sprites**: el hongo no tiene nada de verde, los cinco
  estados marchitos se parecen entre sí, y la hierba en etapa 1 puede quedar casi
  invisible a 30 px.
- **`legacy/`**: 15 MB y 34 archivos versionados de dos repos absorbidos a
  medias. `AGENTS.md` dice que debe vaciarse y desaparecer.

## Sin verificar

- **Si la intención se guarda al salir del campo.** El panel del navegador de la
  herramienta no propaga eventos de foco, así que la ruta interfaz→acción quedó
  sin comprobar. La mutación sí está probada.
- **Un 401 en consola** visto una vez. Solo lo puede devolver el endpoint de
  tarjetas de música, que exige sesión de Spotify; no se pudo reproducir.

## Cómo se trabaja aquí

- Rama por tarea, commit y push al cerrarla, y fusión a `main` con avance rápido.
- `npx tsc --noEmit`, `npm run lint`, `npx vitest run` y `npm run build` antes de
  cada commit.
- Verificación contra la build de producción en el 3100
  (`.claude/launch.json`, entrada `dashboard-prod`), no contra el servidor de
  desarrollo.
- Si una comprobación toca datos del usuario, se restaura el estado previo y se
  dice.
