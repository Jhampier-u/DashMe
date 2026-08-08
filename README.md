# Dashboard personal

Hábitos, tareas, proyectos y un jardín que crece con ellos.

Nació de fusionar cuatro proyectos que vivían por separado:
[Untap](https://github.com/Jhampier-u/Untap) (hábitos, tareas y proyectos),
[Voidtify](https://github.com/Jhampier-u/Voidtify) (organizador de Spotify),
[Portafolio](https://github.com/Jhampier-u/Portafolio) y
[SpotifyCalificar](https://github.com/Jhampier-u/SpotifyCalificar).

**Música volvió a salir.** El 8 de agosto de 2026 se retiró del dashboard y
vuelve a ser una app aparte; puede que algún día regrese. Su código sigue en el
historial, en la etiqueta `musica-antes-de-salir`, y sus tablas siguen en la
base de datos sin tocar — retirarlas del esquema no borró ninguna fila.

## Arranque

```bash
npm install
npm run dev
```

## Estructura

- `src/app/` — solo enrutado
- `src/modules/<dominio>/` — la lógica, expuesta por su `index.ts`
- `src/modules/core/` — conexión a la base, `ui/`, `shell/`
- `docs/superpowers/` — specs y planes

Los módulos no se importan por dentro: solo a través de su `index.ts`.
