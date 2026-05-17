# 🌱 Untap

> Gestor de hábitos, tareas y proyectos al estilo pixel art (Stardew Valley + Pokémon GBA).
> Construido para combatir la procrastinación con gamificación honesta.

![Untap](https://img.shields.io/badge/Next.js-16-black) ![](https://img.shields.io/badge/Prisma-7-blueviolet) ![](https://img.shields.io/badge/TypeScript-5-blue) ![](https://img.shields.io/badge/Tailwind-4-38bdf8)

---

## ✨ Qué tiene

### Hábitos
- 🌱 Rachas con cálculo automático
- 🛡️ **Escudos de racha** — 2 vidas/mes que perdonan un día perdido (regeneran cada 15 días)
- ◐ **Modo mínimo viable** — versión "modo flojo" del hábito que da 50% XP en días de poca energía
- 👑 **Hábito ancla** — designas UNO como el más importante, da +10 XP bonus al cumplirlo
- 📅 **Programación por día** — hábitos diarios o solo lun-mié-vie, etc.
- 💭 **Implementation intentions** — campo "Cuando X entonces Y" para reforzar el trigger
- ⚠️ **Regla de los 2 días** — banner crítico cuando fallaste ayer
- 📆 Calendario mensual por hábito con backfill (hasta 60 días atrás)

### Tareas
- 📝 Kanban: **Por iniciar / En proceso / Completadas**
- ◄ ► Movimiento entre columnas con botones
- +15 XP al completar

### Proyectos
- 📁 Lista de proyectos con icono, color y barra de progreso
- 🌳 **Subtareas anidadas infinitas** (árbol)
- Click en círculo para ciclar estado · click en título para renombrar inline
- Conteo recursivo de hijos completados

### Jardín
- 🌳 Pestaña propia con escena pixel grande
- 🌅 **Ciclo día/noche real** — el cielo cambia con tu hora local (6 fases: amanecer, mañana, mediodía, tarde, atardecer, noche)
- ⭐ Estrellas pulsantes de noche, 🌙 luna o ☀️ sol según hora
- ☁️ Nubes flotando, 🏔️ silueta de montañas, 🪵 cerca de madera
- 🦋 Mariposas/abejas animadas alrededor de plantas maduras
- 🌱 Cada hábito es una planta con 5 etapas de crecimiento (semilla → brote → joven → madura → floreciente)
- 5 especies: Flor 🌻 · Árbol 🌳 · Hongo 🍄 · Cactus 🌵 · Hierba 🌾
- 💧 **Click en planta para regarla** desde el jardín
- 🥀 Las plantas se marchitan si rompes la racha (recuperables)

### Gamificación
- 🆙 Nivel + XP persistente con curva cuadrática (Nv 2 = 100 XP, Nv 5 = 1000 XP)
- 🏆 **Misiones diarias** auto-generadas: Trío del día, Madrugador, Productividad, Constructor, Día perfecto
- 🔥 Hitos de racha con bonus XP: 7d/14d/30d/60d/100d
- 🎉 Toasts animados estilo Pokémon para level-up, milestones, anclas, misiones, escudos
- ✨ Partículas pixel al completar hábitos
- 🧙 Avatar con humor según % de hábitos del día (😴 / 🧙 / 🧙‍♂️ / 🦸)

### Audio
- 🔊 Sonidos 8-bit sintetizados en tiempo real con WebAudio (cero archivos)
- Mute toggle persistente en NavBar
- Sonidos diferenciados: chime / minimal / fanfare / undo / shield / milestone / anchor / quest

---

## 🛠 Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Lenguaje | TypeScript 5 |
| UI | Tailwind CSS 4 |
| Base de datos | SQLite (vía `@prisma/adapter-better-sqlite3`) |
| ORM | Prisma 7 |
| Fuentes | VT323 + Press Start 2P (Google Fonts) |

---

## 📋 Requisitos

- **Node.js ≥ 20** (recomendado 22 LTS) — descarga: https://nodejs.org
- **npm ≥ 10** (incluido con Node)
- **Git** — descarga: https://git-scm.com

Verifica que están instalados:

```bash
node --version    # debería decir v20.x.x o superior
npm --version     # 10.x.x o superior
git --version
```

---

## 🚀 Instalación en una PC nueva

### Paso 1 — Clonar el repositorio

```bash
git clone https://github.com/TU_USUARIO/untap.git
cd untap
```

### Paso 2 — Instalar dependencias

```bash
npm install
```

> Tarda ~1-2 minutos la primera vez. Descarga ~360 paquetes.

### Paso 3 — Crear archivo de configuración `.env`

**En PowerShell (Windows):**

```powershell
'DATABASE_URL="file:./dev.db"' | Out-File -Encoding utf8 .env
```

**En macOS/Linux/Git Bash:**

```bash
echo 'DATABASE_URL="file:./dev.db"' > .env
```

> El archivo `.env` define dónde vive tu base de datos local. No se sube al repo (está en `.gitignore`).

### Paso 4 — Inicializar la base de datos

```bash
npx prisma migrate dev --name init
```

Esto:
1. Crea el archivo `dev.db` (SQLite vacío)
2. Aplica todas las migraciones del schema
3. Genera el cliente Prisma en `src/generated/prisma/`

### Paso 5 — Arrancar la app

```bash
npm run dev
```

Abre tu navegador en **http://localhost:3000** 🎉

---

## 🔄 Tras hacer `git pull` (recibir cambios del repo)

Si la actualización incluyó cambios en `prisma/schema.prisma`, ejecuta:

```bash
npm install                  # por si hay dependencias nuevas
npx prisma migrate dev       # aplica nuevas migraciones a tu DB local
npx prisma generate          # regenera el cliente TS de Prisma
```

Luego **reinicia el servidor** (`Ctrl+C` y `npm run dev` de nuevo) — Turbopack cachea el cliente Prisma en memoria y a veces no recoge el regenerado automáticamente.

---

## 📁 Estructura del proyecto

```
untap/
├── prisma/
│   ├── schema.prisma          # Modelo de datos (Habit, Task, Project, etc.)
│   └── migrations/            # Historial de cambios SQL
├── src/
│   ├── app/                   # Rutas Next.js (App Router)
│   │   ├── page.tsx           # / — Inicio (dashboard)
│   │   ├── habits/page.tsx    # /habits
│   │   ├── garden/page.tsx    # /garden
│   │   ├── tasks/page.tsx     # /tasks
│   │   ├── projects/          # /projects + /projects/[id]
│   │   ├── actions.ts         # Server Actions (mutaciones Prisma)
│   │   ├── api/               # Endpoints JSON (habit-month, habit-stats)
│   │   ├── layout.tsx         # Layout raíz con NavBar
│   │   └── globals.css        # Tokens de diseño pixel art
│   ├── components/            # Componentes pixel art reutilizables
│   │   ├── NavBar.tsx
│   │   ├── PlayerStatus.tsx
│   │   ├── HabitToggle.tsx
│   │   ├── HabitGarden.tsx
│   │   ├── GardenScene.tsx
│   │   ├── DailyQuestsPanel.tsx
│   │   ├── AchievementToast.tsx
│   │   ├── SoundEffects.tsx / SoundToggle.tsx
│   │   └── ...
│   └── lib/                   # Lógica de dominio
│       ├── prisma.ts          # Cliente Prisma singleton
│       ├── habits.ts          # Queries + cálculo de rachas
│       ├── level.ts           # Curva de XP y constantes
│       ├── garden.ts          # Especies de plantas + etapas
│       ├── quests.ts          # Generación de misiones diarias
│       ├── stats.ts           # Estadísticas globales + heatmap
│       ├── tasks.ts           # Queries de tareas
│       ├── projects.ts        # Queries de proyectos + árbol
│       └── sound.ts           # Sintetizador WebAudio
├── Tareas.txt                 # Backlog de features
├── package.json
├── tsconfig.json
└── README.md
```

---

## 📦 Build de producción

```bash
npm run build
npm run start
```

> El build optimiza todo y arranca en modo producción (más rápido pero sin HMR).

---

## 💾 Backup y restauración de tus datos

Toda tu información vive en **un único archivo**: `dev.db` (en la raíz del proyecto).

### Hacer backup
Copia `dev.db` a una carpeta segura (USB, OneDrive, Google Drive, etc.).

### Restaurar
Reemplaza `dev.db` con tu backup. Listo.

### Migrar entre PCs
1. En la PC vieja: copia `dev.db`
2. En la PC nueva: clona el repo, `npm install`, crea `.env`, `npx prisma migrate dev`
3. **Reemplaza** el `dev.db` recién creado con tu backup
4. `npm run dev`

> ⚠️ **Los datos NO se sincronizan automáticamente entre PCs.** Cada instalación tiene su propia DB local. Para sincronización real necesitarías desplegar con Postgres en la nube (ver "Roadmap" abajo).

---

## 🐛 Troubleshooting

### "Cannot read properties of undefined (reading 'findMany')"
El cliente Prisma está cacheado en memoria con un schema viejo.
**Solución:** `npx prisma generate` y reinicia `npm run dev` (mata el proceso de Node con `Ctrl+C` o `Stop-Process -Name node -Force` en PowerShell).

### "Port 3000 is in use"
Otro proceso de Next ya está corriendo.
**Solución (Windows):**
```powershell
Stop-Process -Name node -Force
```
o `taskkill /PID <pid> /F` con el PID que reporta el error.

### "P1012: datasource property `url` is no longer supported"
Estás en Prisma 7. El URL no va en `schema.prisma` sino en `prisma.config.ts` (ya configurado).

### El build falla con error de `better-sqlite3`
Módulo nativo no recompilado. Ejecuta:
```bash
npm rebuild better-sqlite3
```

### Sonidos no se oyen
Activa el botón 🔊 en la NavBar (arriba a la derecha). Por defecto arranca muteado.

---

## ⌨️ Comandos cheatsheet

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con HMR |
| `npm run build` | Build de producción |
| `npm run start` | Servir build de producción |
| `npm run lint` | Lint con ESLint |
| `npx prisma studio` | GUI web para inspeccionar/editar la DB |
| `npx prisma migrate dev` | Aplicar migraciones pendientes |
| `npx prisma migrate dev --name nombre` | Crear nueva migración tras cambios al schema |
| `npx prisma generate` | Regenerar cliente TS de Prisma |
| `npx prisma migrate reset` | ⚠️ Borra DB y reaplica todo desde cero |

---

## 🗺 Roadmap

Ver `Tareas.txt` para el backlog completo. Próximos hitos posibles:

- **Pack: El mundo respira** — day/night global, avatar animado por frames, confetti mejorado, NPC narrador
- **Pack: Logros que importan** — medallero, misiones semanales, mejor hora del día, reflexión diaria
- **Pack: Productividad** — pomodoro, deadlines, drag-and-drop en Kanban, búsqueda global
- **Deploy** — Postgres (Neon) + Vercel + contraseña → sincronización entre dispositivos
- **App de escritorio** — empaquetado con Electron (.exe portable)

---

## 📝 Licencia

Proyecto personal. Úsalo, modifícalo, comparte como quieras.

---

Hecho con ☕ y pixeles.
