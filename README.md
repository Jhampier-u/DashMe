# Dashboard personal

Un solo lugar para mis apps, hábitos y música.

Fusiona cuatro proyectos que antes vivían por separado:
[Untap](https://github.com/Jhampier-u/Untap) (hábitos, tareas y proyectos),
[Voidtify](https://github.com/Jhampier-u/Voidtify) (organizador de Spotify),
[Portafolio](https://github.com/Jhampier-u/Portafolio) y
[SpotifyCalificar](https://github.com/Jhampier-u/SpotifyCalificar).
Esos cuatro repos quedan congelados como archivo: el desarrollo ocurre aquí.

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
