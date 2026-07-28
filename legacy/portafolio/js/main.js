/* ============================================================
   JUAMPE · Portafolio — interactions
   ============================================================ */

/* ---------- PROJECT DATA ---------- */
const PROJECTS = [
  {
    id: "udaexplore",
    name: "UDAExplore",
    cat: "Full-Stack",
    cats: ["fullstack"],
    tagline: "Plataforma de evaluación del potencial turístico territorial",
    shots: 5,
    tags: ["Laravel 12","PHP 8.2","PostgreSQL","Blade","Tailwind","Alpine.js","Chart.js","Docker","Render"],
    links: [
      { label: "🌐 Demo en vivo", url: "https://gestion-turistica.onrender.com" },
      { label: "📂 GitHub", url: "https://github.com/Jhampier-u/proyecto-turismo" }
    ],
    short: "Digitalicé de extremo a extremo la metodología de diagnóstico turístico de la Universidad del Azuay: de 4 hojas de cálculo sin trazabilidad a un entorno colaborativo con cálculo automatizado y control por rol.",
    desc: [
      "Plataforma full-stack que diseñé y desarrollé de extremo a extremo —del modelado de datos al despliegue en producción— para sistematizar el diagnóstico turístico territorial de la Escuela de Turismo de la <b>Universidad del Azuay</b>. Transformó una metodología que vivía en cuatro hojas de cálculo, sin trazabilidad ni colaboración real, en un único entorno con cálculo automatizado, control de acceso por rol y visualizaciones en tiempo real.",
      "Integra cuatro módulos —Inventario, Vocación Turística, Potencialidad y Percepción— bajo una arquitectura MVC en <b>Laravel 12 / PHP 8.2</b> con persistencia en PostgreSQL. Cada módulo replica con precisión milimétrica los pesos, escalas y fórmulas oficiales validadas por la facultad: la fidelidad metodológica fue innegociable.",
      "El reto más interesante fue resolver la rigidez del modelo original con un sistema de <b>configuración dinámica de campos por zona</b> (persistido como vector JSON) que reasigna proporcionalmente los pesos cuando un grupo de criterios no aplica al territorio. El despliegue usa un Dockerfile multi-stage en Render con CI/CD desde GitHub."
    ],
    feats: [
      "Cálculo automatizado server-side con fórmulas académicas exactas",
      "3 roles (Admin, Jefe de Zona, Equipo Operativo) con estados borrador/confirmado",
      "Pesos dinámicos por zona persistidos como vector JSON",
      "Gráficos radar y dispersión por cuadrantes con Chart.js",
      "Dockerfile multi-stage + despliegue CI/CD en Render bajo HTTPS"
    ]
  },
  {
    id: "ledger",
    name: "Ledger",
    cat: "Full-Stack",
    cats: ["fullstack"],
    tagline: "Organizador editorial de bibliotecas de Spotify",
    shots: 4,
    tags: ["Next.js 16","TypeScript","Tailwind v4","SQLite","Drizzle ORM","Auth.js v5","Spotify API","Last.fm"],
    links: [],
    short: "App web full-stack que recupera el control de tu biblioteca de Spotify: tags personalizados, smart playlists por reglas, detección de duplicados y stats — con caché local y rate limiting para sobrevivir a la API de Spotify.",
    desc: [
      "Una app web full-stack que devuelve al usuario las herramientas que Spotify esconde tras algoritmos opacos: filtrar por género dentro de una playlist, etiquetar canciones, detectar duplicados y crear <b>smart playlists basadas en reglas</b>. Todo con una interfaz editorial inspirada en revistas de música impresas, no en otra clonación oscura del cliente oficial.",
      "Apunté a <b>\"magazine spread + vinyl liner notes\"</b> con un sistema visual propio (sin shadcn ni librerías de UI): tipografía editorial Fraunces + JetBrains Mono, paleta cálida con un acento chartreuse quirúrgico, grain sutil y marquee editorial.",
      "Arquitectura <b>local-first</b>: lo que puede resolverse desde SQLite local no toca Spotify. La biblioteca, los géneros, los tags y las reglas viven en una DB local; Spotify es la fuente de verdad pero no un cuello de botella. Rate limiting global y retry con exponential backoff para sobrevivir a las restricciones de la API."
    ],
    feats: [
      "Tags personalizados con colores, filtrado y materialización a playlist",
      "Smart playlists con reglas declarativas que se sincronizan a demanda",
      "Detector de duplicados con limpieza un-click + fusión de playlists",
      "Filtros por género enriquecidos vía Last.fm + Spotify",
      "Página de stats: top artistas, álbumes, géneros y evolución temporal",
      "Caché completo de la biblioteca en SQLite + rate limiting global"
    ]
  },
  {
    id: "sugoi",
    name: "SUGOI Store",
    cat: "Diseño + Dev",
    cats: ["frontend","design"],
    tagline: "Plataforma de diseño personalizado en vivo",
    shots: 4,
    tags: ["HTML5","CSS3","JS ES6+","Canvas API","SVG","Photoshop JSX","clip-path"],
    links: [],
    short: "Para una marca cuencana de prendas personalizadas: un editor donde el cliente diseña en vivo sobre mockups fotorrealistas y recibe una cotización automática enviada por WhatsApp. Algo que ninguna marca local del sector ofrecía.",
    desc: [
      "<b>SUGOI Store</b> es una marca cuencana de prendas y accesorios personalizados. Su problema era típico del comercio personalizado: los compradores no podían visualizar su diseño antes de pagar, lo que generaba devoluciones y fricción. Necesitaban algo que ninguna marca local ofrecía: un sitio donde el cliente <b>diseñe en vivo y reciba una cotización automática</b>.",
      "Construí una landing institucional con sistema de diseño propio (lenguaje cómic-streetwear cuencano: tipografía Bungee, azul eléctrico + amarillo voltaje, sombras duras de viñeta y patrones halftone) y, como pieza estrella, un <b>editor de diseño interactivo</b>.",
      "El tintado de prendas en 18 colores lo resolví con <b>Canvas API</b> y globalCompositeOperation (destination-in para enmascarar la silueta, multiply para hornear las sombras reales encima), tras descartar un primer intento con mix-blend-mode que fallaba entre navegadores. Además automaticé la exportación de mockups con un script JSX que controla Photoshop vía COM desde PowerShell: de horas de trabajo manual a minutos."
    ],
    feats: [
      "Editor con drag & drop: redimensionar, rotar y reposicionar vía pointer events (touch + mouse)",
      "Tintado dinámico en 18 colores con Canvas API y composite operations",
      "Automatización de mockups desde PSDs con script JSX + Photoshop COM",
      "Vista frente/espalda con áreas de impresión calibradas por producto",
      "Cotizador en tiempo real que genera mensaje pre-llenado para WhatsApp"
    ]
  },
  {
    id: "pokedex",
    name: "Pokédex Research",
    cat: "Pixel Art",
    cats: ["frontend","pixel"],
    tagline: "National Dex interactiva · 1.025 Pokémon",
    shots: 3,
    tags: ["HTML5","CSS3","JavaScript","PokéAPI","Web Audio API","localStorage"],
    links: [{ label: "📂 GitHub", url: "https://github.com/Jhampier-u/Pokedex" }],
    short: "Una Pokédex web inmersiva en JS puro que consume la PokéAPI: los 1.025 Pokémon de 9 regiones, diseño pixel-art fiel al hardware clásico, audio procedural en tiempo real y cinco minijuegos completos.",
    desc: [
      "Una Pokédex web de alto nivel técnico construida en <b>HTML, CSS y JavaScript puro</b> (sin frameworks ni build tools) que consume la PokéAPI. Integra los <b>1.025 Pokémon</b> de las nueve regiones con un diseño pixel-art fiel al hardware clásico.",
      "Se siente como un Pokédex de verdad: una animación cinematográfica abre el dispositivo, la interfaz se tiñe en vivo con el color del tipo del Pokémon centrado, y un <b>acorde ambiental procedural generado con Web Audio API</b> cambia de tonalidad según la región (Kanto en La menor, Hoenn en Do mayor…), sin archivos de audio externos.",
      "Cada Pokémon despliega descripción real traducida (30+ versiones del juego), árbol de evolución con métodos detallados, matriz de debilidades calculada en cliente para dual-types, formas alternativas, y tres modos: GRITO (cry real), SHINY y ANIM. Incluye un catálogo coverflow navegable por teclado, swipe y filtros combinados."
    ],
    feats: [
      "🎵 Audio ambiental procedural por región con Web Audio API",
      "❓ ¿Quién es ese Pokémon? con racha persistida y 3 dificultades",
      "⚔️ Simulador de batalla 1v1 con fórmula oficial de daño (STAB, efectividad)",
      "🛡️ Constructor de equipo con radar SVG, roles y alertas de cobertura",
      "🎲 Ruleta Nuzlocke con filtros y exclusión de legendarios",
      "Catálogo coverflow + detalle completo con matriz de tipos en cliente"
    ]
  },
  {
    id: "untap",
    name: "Untap",
    cat: "Pixel Art",
    cats: ["fullstack","pixel"],
    tagline: "Gestor de hábitos gamificado · estilo Stardew/GBA",
    shots: 4,
    tags: ["Full-Stack","Pixel Art","Gamificación","localStorage","Psicología conductual"],
    links: [],
    short: "Un gestor de hábitos full-stack que combina gamificación profunda, pixel art y psicología del comportamiento (BJ Fogg, James Clear) para combatir la procrastinación sin castigar al usuario. Fallar un día no significa rendirse.",
    desc: [
      "Aplicación web full-stack que combina <b>psicología del comportamiento, gamificación profunda y pixel art</b> para combatir la procrastinación de forma sostenible. Inspirada visualmente en Stardew Valley y Pokémon GBA.",
      "Los gestores de hábitos clásicos castigan al indisciplinado: rompes una racha → pierdes motivación → abandonas. Untap aplica mecánicas de juego y principios de <b>BJ Fogg y James Clear</b> para crear un loop de motivación a largo plazo donde fallar un día no significa rendirse.",
      "Sistema de XP cuadrático persistente, hitos de racha con bonus escalonados (7/14/30/60/100 días), misiones diarias auto-generadas por hash de fecha y un avatar con 4 estados emocionales según tu progreso del día."
    ],
    feats: [
      "🛡️ Streak Shields: 2 vidas/mes que perdonan días perdidos y regeneran solas",
      "◐ Modo mínimo viable: 50% XP en días de poca energía manteniendo la racha",
      "👑 Hábito ancla con bonus y celebración especial",
      "💭 Implementation intentions estilo BJ Fogg (\"Cuando X entonces Y\")",
      "⚠️ Regla de los 2 días con banner crítico anti-abandono",
      "Curva de XP cuadrática + misiones diarias deterministas por fecha"
    ]
  },
  {
    id: "linaje",
    name: "Linaje · Generación al Rescate",
    cat: "Front-End",
    cats: ["frontend"],
    tagline: "Sitio multipágina para un grupo de jóvenes",
    shots: 6,
    tags: ["HTML5","CSS3","JavaScript","GitHub Pages","Diseño modular"],
    links: [],
    short: "Sitio web de 9 páginas diseñado y desarrollado de extremo a extremo, sin frameworks, para el grupo de jóvenes de mi iglesia. Arquitectura CSS modular por componente y un sistema de diseño coherente alrededor de una paleta dark + fuego.",
    desc: [
      "Sitio web multipágina que diseñé y desarrollé de extremo a extremo para el grupo de jóvenes de mi iglesia, construido <b>sin frameworks</b> (HTML5, CSS3 y JavaScript vanilla) y desplegado en GitHub Pages.",
      "Integra <b>9 páginas únicas</b>: home, página general de grupos, 6 subpáginas dedicadas a cada grupo de estudio con identidad visual propia, y un calendario de actividades interactivo.",
      "Todo se sostiene sobre una arquitectura modular de <b>CSS por componente</b> y un sistema de diseño coherente alrededor de una paleta dark con degradados de fuego, inspirada en el logo de la marca."
    ],
    feats: [
      "9 páginas únicas con identidad visual propia por sección",
      "Calendario de actividades interactivo",
      "Arquitectura CSS modular por componente",
      "Sistema de diseño coherente (paleta dark + degradados de fuego)",
      "Desplegado en GitHub Pages"
    ]
  }
];

/* ---------- RENDER PROJECT CARDS ---------- */
const projectsEl = document.getElementById("projects");

function cardHTML(p){
  const tags = p.tags.slice(0,4).map(t=>`<span class="tag">${t}</span>`).join("");
  return `
  <article class="pcard reveal" data-cats="${p.cats.join(" ")}" data-id="${p.id}" tabindex="0">
    <div class="pcard__thumb">
      <span class="pcard__cat">${p.cat}</span>
      <img src="assets/projects/${p.id}/shot1.png" alt="${p.name}" loading="lazy">
    </div>
    <div class="pcard__body">
      <h3 class="pcard__name">${p.name}</h3>
      <p class="pcard__desc">${p.short}</p>
      <div class="pcard__tags">${tags}</div>
      <span class="pcard__more">Ver más →</span>
    </div>
  </article>`;
}
projectsEl.innerHTML = PROJECTS.map(cardHTML).join("");

/* ---------- FILTERS ---------- */
const filters = document.getElementById("filters");
filters.addEventListener("click", e=>{
  const btn = e.target.closest(".filter");
  if(!btn) return;
  filters.querySelectorAll(".filter").forEach(f=>f.classList.remove("is-active"));
  btn.classList.add("is-active");
  const f = btn.dataset.filter;
  document.querySelectorAll(".pcard").forEach(card=>{
    const show = f==="all" || card.dataset.cats.includes(f);
    card.style.display = show ? "" : "none";
  });
});

/* ---------- MODAL ---------- */
const modal = document.getElementById("modal");
const modalBody = document.getElementById("modalBody");

function openModal(id){
  const p = PROJECTS.find(x=>x.id===id);
  if(!p) return;
  const shots = Array.from({length:p.shots}, (_,i)=>
    `<img src="assets/projects/${p.id}/shot${i+1}.png" alt="${p.name} captura ${i+1}" loading="lazy" data-zoom>`).join("");
  const desc = p.desc.map(d=>`<p>${d}</p>`).join("");
  const feats = p.feats.map(f=>`<li>${f}</li>`).join("");
  const tags = p.tags.map(t=>`<span class="tag">${t}</span>`).join("");
  const links = p.links.length
    ? `<div class="m-links">${p.links.map(l=>`<a class="btn btn--primary" href="${l.url}" target="_blank" rel="noopener">${l.label}</a>`).join("")}</div>`
    : "";
  modalBody.innerHTML = `
    <span class="m-cat">${p.cat}</span>
    <h3 class="m-title">${p.name}</h3>
    <p class="m-tagline">${p.tagline}</p>
    <div class="m-gallery">${shots}</div>
    <div class="m-desc">${desc}</div>
    <h4 class="m-h">★ Lo que construí</h4>
    <ul class="m-feat">${feats}</ul>
    <h4 class="m-h">⚙ Stack</h4>
    <div class="m-tags">${tags}</div>
    ${links}
  `;
  modal.classList.add("open");
  modal.setAttribute("aria-hidden","false");
  modal.querySelector(".modal__box").scrollTop = 0;
  document.body.style.overflow = "hidden";
}
function closeModal(){
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden","true");
  document.body.style.overflow = "";
}
projectsEl.addEventListener("click", e=>{
  const card = e.target.closest(".pcard");
  if(card) openModal(card.dataset.id);
});
projectsEl.addEventListener("keydown", e=>{
  const card = e.target.closest(".pcard");
  if(card && (e.key==="Enter"||e.key===" ")){ e.preventDefault(); openModal(card.dataset.id); }
});
modal.addEventListener("click", e=>{ if(e.target.dataset.close!==undefined) closeModal(); });
document.addEventListener("keydown", e=>{ if(e.key==="Escape") { closeModal(); closeZoom(); } });

/* ---------- IMAGE ZOOM (lightbox) ---------- */
const zoom = document.createElement("div");
zoom.className = "zoom";
zoom.innerHTML = '<img alt="captura ampliada">';
document.body.appendChild(zoom);
const zoomImg = zoom.querySelector("img");
function closeZoom(){ zoom.classList.remove("open"); }
modalBody.addEventListener("click", e=>{
  const img = e.target.closest("[data-zoom]");
  if(img){ zoomImg.src = img.src; zoom.classList.add("open"); }
});
zoom.addEventListener("click", closeZoom);

/* ---------- TYPEWRITER ---------- */
const phrases = [
  "Desarrollador Full-Stack",
  "Diseñador & Creador de Mundos",
  "Partner @ AdvancedFlow.ai",
  "Líder de Desarrollo Web",
  "Arquitecto de experiencias",
  "Curioso del universo 🔭",
  "Software Engineer Student"
];
const tw = document.getElementById("typewriter");
let pi=0, ci=0, deleting=false;
function type(){
  const word = phrases[pi];
  tw.textContent = deleting ? word.slice(0,--ci) : word.slice(0,++ci);
  let delay = deleting ? 45 : 85;
  if(!deleting && ci===word.length){ delay=1500; deleting=true; }
  else if(deleting && ci===0){ deleting=false; pi=(pi+1)%phrases.length; delay=350; }
  setTimeout(type, delay);
}
type();

/* ---------- REVEAL ON SCROLL ---------- */
const io = new IntersectionObserver((entries)=>{
  entries.forEach(en=>{
    if(en.isIntersecting){
      en.target.classList.add("in");
      en.target.querySelectorAll(".bar__track i").forEach(b=>b.classList.add("go"));
      io.unobserve(en.target);
    }
  });
},{ threshold:.15 });
document.querySelectorAll(".reveal").forEach(el=>io.observe(el));

/* ---------- NAV BURGER ---------- */
const burger = document.getElementById("burger");
const navLinks = document.getElementById("navLinks");
burger.addEventListener("click", ()=> navLinks.classList.toggle("open"));
navLinks.addEventListener("click", e=>{ if(e.target.tagName==="A") navLinks.classList.remove("open"); });

/* ---------- KONAMI EASTER EGG ---------- */
const KONAMI = ["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a"];
let kbuf = [];
document.addEventListener("keydown", e=>{
  kbuf.push(e.key.length===1 ? e.key.toLowerCase() : e.key);
  kbuf = kbuf.slice(-KONAMI.length);
  if(KONAMI.every((k,i)=>k===kbuf[i])) confettiHearts();
});
function confettiHearts(){
  const emojis = ["💖","🌸","✨","⭐","🎮","🃏","🔭","🎹"];
  for(let i=0;i<60;i++){
    const s = document.createElement("span");
    s.textContent = emojis[Math.floor(Math.random()*emojis.length)];
    s.style.cssText = `position:fixed;z-index:999;left:${Math.random()*100}vw;top:-40px;
      font-size:${18+Math.random()*26}px;pointer-events:none;
      transition:transform 2.6s cubic-bezier(.3,.7,.4,1),opacity 2.6s;`;
    document.body.appendChild(s);
    requestAnimationFrame(()=>{
      s.style.transform = `translateY(${100+Math.random()*30}vh) rotate(${Math.random()*720-360}deg)`;
      s.style.opacity = "0";
    });
    setTimeout(()=>s.remove(), 2700);
  }
  const note = document.createElement("div");
  note.textContent = "★ ¡CÓDIGO KONAMI ACTIVADO! +99 puntos de estilo ★";
  note.style.cssText = `position:fixed;z-index:1000;left:50%;top:50%;transform:translate(-50%,-50%);
    font-family:'Press Start 2P',monospace;font-size:14px;color:#fff;background:#d6457f;
    border:4px solid #4a3a52;border-radius:14px;padding:18px 22px;box-shadow:8px 8px 0 #4a3a52;text-align:center;`;
  document.body.appendChild(note);
  setTimeout(()=>note.remove(), 2600);
}

/* ---------- ACTIVE NAV HIGHLIGHT ---------- */
const navItems = [...document.querySelectorAll(".nav__links a")];
const navIO = new IntersectionObserver((entries)=>{
  entries.forEach(en=>{
    if(en.isIntersecting){
      const id = en.target.id;
      navItems.forEach(a=> a.style.background = a.getAttribute("href")===`#${id}` && !a.classList.contains("nav__cta") ? "var(--pink-soft)" : "");
    }
  });
},{ rootMargin:"-45% 0px -50% 0px" });
document.querySelectorAll("section[id]").forEach(s=>navIO.observe(s));
