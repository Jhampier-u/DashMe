# Archivo de Untap

Untap era una aplicación independiente
([github.com/Jhampier-u/Untap](https://github.com/Jhampier-u/Untap)) antes de
fusionarse en este dashboard. Su código vive ahora en
`src/modules/habitos/` y sus rutas están en español (`/habitos`, `/tareas`,
`/proyectos`, `/jardin`).

Esta carpeta conserva lo que no era código pero sí valía:

- **`README-original.md`** — la descripción completa de todas las
  funcionalidades: escudos de racha, modo mínimo viable, hábito ancla, misiones
  diarias, el jardín con ciclo día/noche. Es la mejor referencia de qué hace
  cada cosa y por qué.
- **`backlog-de-ideas.txt`** — ideas pendientes que nunca se implementaron.
  Sigue siendo el backlog vivo del módulo.
- **`specs/`** y **`plans/`** — los 12 documentos de diseño de las funciones que
  sí se construyeron. Explican decisiones que el código no cuenta: por qué las
  rachas perdonan un día, por qué el ranking mide cada hábito sobre sus propios
  días, por qué se retiró el sistema pixel.

La historia de commits de Untap está en este mismo repo: los 88 commits
originales entraron con `git subtree` y son alcanzables por SHA.
