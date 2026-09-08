# Dónde está el proyecto

`main` sincronizado con el remoto · 637 tests en verde · sin ramas abiertas.

Este archivo existe para que retomar no dependa de la memoria de nadie. Si
vuelves después de meses, o si quien vuelve es otro, **empieza por aquí**.

Los tres documentos largos son [la auditoría](auditoria-2026-08-07.md), [la
propuesta](propuesta-2026-08-08.md) y [el formato de
exportación](formato-export.md).

## Qué es esto

Un dashboard personal: **hábitos, tareas, proyectos y un jardín** que crece con
ellos. Next.js 16.2.12 sobre Drizzle y SQLite, todo local, sin servidor y sin
cuentas. Rutas en español.

```bash
npm run dev
```

Las reglas de arquitectura están en `AGENTS.md` y son cortas: `src/app/` solo
enruta, la lógica vive en `src/modules/<dominio>/`, y **nada de fuera de un
módulo entra por otro sitio que su `index.ts`**.

## Lo hecho

| Sección | Estado |
|---|---|
| **Hábitos** | Hallazgos 1 y 2, bonus por volver, racha que perdona un fallo, intención a la vista, estado «interiorizado» y el SRBAI que lo sugiere |
| **Jardín** | Pixel art, huecos colocables, timelapse, tienda, cielo de un tono, fauna honesta y la memoria de UbiFit |
| **Tareas** | Hallazgos 3 y 4, filtros por grupos con recuentos y chips, bolita de estado en las tarjetas |
| **Proyectos** | Auditado en datos e interfaz: cabecera honesta, frases unificadas, tarjeta pulsable |
| **Inicio** | Arreglada de rebote por los hallazgos 1 y 2 |
| **Datos** | Exportación honesta y reimportable en `/api/exportar` |

Del informe **no queda nada pendiente**: las cinco secciones auditadas y las
cuatro propuestas implementadas.

## Los datos

La base es `data/juampi.db` y **no está versionada**. Ahora mismo tiene las 12
tablas del dashboard y nada más.

**Se perdió una vez, el 26 de agosto de 2026, y se recuperó entera** de un
volcado en `%USERPROFILE%\OneDrive\Voidtify-copias\`. De ahí salió la
exportación honesta: un export que nunca se ha vuelto a importar es una
promesa, no una salida.

**Música es otra app.** Vive en `C:\Voidtify`, con su propia base
(`data/ledger.db`, unas 273.000 escuchas) y sus copias diarias comprimidas y
verificadas. **Sus datos no están en `juampi.db`.** El código que tuvo el
dashboard está en la etiqueta `musica-antes-de-salir`.

Los adjuntos de tareas viven en `data/adjuntos/` y **la exportación NO los
lleva**: es lo único que un volcado no basta para restaurar.

## Cosas que muerden

Errores que ya se han cometido aquí. Cada uno costó una sesión.

- **El reloj de la máquina salta.** Los commits de una misma tarde llevan fechas
  con 19 días de diferencia. No deduzcas cronología de las fechas de git ni de
  las de fichero; si necesitas la fecha, pregúntala.
- **`SCHEMA_SQL` es una plantilla literal.** Un acento grave dentro de un
  comentario SQL la parte a media cadena. El propio fichero lo avisa y aun así
  ha vuelto a pasar.
- **Un día es medianoche UTC de la fecha LOCAL** (`lib/day.ts`). Sembrar datos
  con medianoche local mete un desfase silencioso. Y `daysBetween(a, b)` es
  **a − b**: para «días desde entonces» se usa `daysSince`.
- **Las transacciones de Drizzle son SÍNCRONAS.** Dentro de `db.transaction`
  van `.run()`, no `await`.
- **El panel del navegador de la herramienta tiene ventana 0×0.** No hay
  capturas, ni `elementFromPoint`, ni eventos de foco. Se verifica leyendo el
  DOM, los estilos calculados y la red. Para lo visual, **hay que mirarlo a
  ojo**.
- **`node -e` con comillas se come las barras invertidas.** Para cualquier
  cosa con expresiones regulares, escribe el script a un fichero.
- **`exportarTodo` lee la base entera.** Para un recuento está `contarTodo`.

## Decisiones tuyas, sin resolver

- **El repositorio es público** —`github.com/Jhampier-u/DashMe`— y dos planes de
  `docs/superpowers/plans/` nombran tus hábitos reales.

## Sin verificar

- **Si la intención se guarda al salir del campo.** La mutación está probada; la
  ruta interfaz→acción no, porque el panel no propaga eventos de foco. Es lo
  único construido que nunca se vio funcionar de punta a punta.
- **Los sprites a tamaño real.** Las tres dudas se cerraron midiendo celdas y
  contraste, no mirándolos.

## Nunca auditado

El módulo de música: 79 ficheros y unas 11.900 líneas sin un solo test cuando
salió. Ahora es una app aparte y su calidad es problema suyo, pero conviene
saber que nadie la revisó.

## Cómo se trabaja aquí

- Rama por tarea, commit y push al cerrarla, fusión a `main` con avance rápido.
- `npx tsc --noEmit`, `npm run lint`, `npx vitest run` y `npm run build` antes
  de cada commit. **`tsc` después de `npm run build`**: los tipos de las rutas
  los genera Next en `.next/`.
- Verificación contra la build de producción en el 3100 (`.claude/launch.json`,
  entrada `dashboard-prod`), no contra el servidor de desarrollo.
- Si una comprobación toca datos del usuario, **se siembra, se mide y se
  restaura el estado previo — y se dice que se hizo**.
- Una duda de aspecto se convierte en número antes de discutirla, y el número
  se deja como test para que no vuelva.
