# 🌸 Portafolio · Juampe

Portafolio profesional de **Juan Pedro Pesántez** — estética *pixel-art kawaii / cute-dev* en colores pastel.
HTML, CSS y JavaScript puro (sin frameworks ni build tools). Listo para compartir.

## 📂 Estructura

```
site/
├─ index.html          # página única con todas las secciones
├─ css/styles.css      # sistema de diseño pixel-kawaii pastel
├─ js/main.js          # datos de proyectos, modal, filtros, typewriter, easter egg
└─ assets/projects/    # capturas de cada proyecto (shot1.png, shot2.png, …)
```

## ✨ Qué incluye

- **Hero** con avatar pixel-art, ficha de jugador (HP/MP) y máquina de escribir animada.
- **Sobre mí** con ficha de personaje estilo RPG y frase-filosofía.
- **Inventario de Skills** con barras animadas y marquee de tecnologías.
- **Proyectos** filtrables (Full-Stack / Front-End / Pixel Art / Diseño) con galería en modal y zoom de imágenes.
- **Side Quests** (hobbies e intereses).
- **Contacto** con enlaces a GitHub y demo.
- 🎮 Easter egg: prueba el **código Konami** (↑↑↓↓←→←→ B A).

## ▶ Ver en local

Abre `index.html` directamente en el navegador, o levanta un servidor:

```bash
# con Node
npx serve site

# o con Python
python -m http.server -d site 4321
```

## 🚀 Publicar en GitHub Pages

1. Crea un repo (p. ej. `portafolio`) y sube **el contenido de la carpeta `site/`** a la raíz.
2. En *Settings → Pages*, elige la rama `main` y carpeta `/ (root)`.
3. Listo: tu portafolio quedará en `https://Jhampier-u.github.io/portafolio/`.

> Tip: si subes la carpeta `site/` completa en vez de su contenido, ajusta la fuente de Pages a `/site`.

## 🎨 Personalizar

- **Colores**: variables CSS en `:root` (`--pink`, `--lav`, `--magenta`, …) al inicio de `styles.css`.
- **Proyectos**: edita el array `PROJECTS` en `js/main.js` (nombre, tags, descripción, links, nº de capturas).
- **Capturas**: reemplaza/añade imágenes en `assets/projects/<proyecto>/shotN.png` y actualiza `shots` en el array.

Hecho con código, café y mucho cariño 💖
