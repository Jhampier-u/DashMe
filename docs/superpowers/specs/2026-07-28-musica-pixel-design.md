# Música en pixel-kawaii · diseño

**Fecha:** 2026-07-28
**Estado:** aprobado, listo para planificar
**Paso:** 7 de 7 del rediseño visual

---

## 1. Objetivo

Llevar música al sistema pixel-kawaii y con ello terminar el rediseño. Es el
bloque más grande con diferencia: 7.537 líneas en 37 archivos, más que todo lo
anterior junto.

## 2. Punto de partida

Música es la única sección que nunca usó el lenguaje oscuro `--m-*` —que ya se
borró— porque tiene un sistema visual **propio y terminado**: editorial oscuro,
Fraunces para los títulos, JetBrains Mono para las etiquetas, y una paleta de
nueve tonos más siete colores de etiqueta.

Y tiene una propiedad que ninguna otra sección tenía: **se consume casi entero
por utilidades de Tailwind sobre `@theme`**. 760 usos, cero hexadecimales
sueltos. Eso abre una vía que no existía antes.

### La estrategia: remapear en vez de reescribir

Cambiar los valores del `@theme` voltea los 760 usos de una vez, sin tocar 37
archivos.

**Lo que el remapeo no puede resolver es el doble rol.** Los nombres describen
un mundo oscuro, y algunos se usan para las dos cosas:

| Uso | Veces | Significa hoy | Tras remapear sale |
|---|---:|---|---|
| `text-cream` | 57 | texto claro sobre oscuro | tinta sobre papel ✅ |
| `text-mute` | 214 | texto terciario | tinta sobre papel ✅ |
| `text-ink` | 24 | texto **oscuro** sobre cápsula clara | papel sobre claro ❌ |
| `bg-cream` · `hover:bg-cream` | 17+ | relleno **claro** | tinta, y su texto queda oscuro sobre oscuro ❌ |

Los rotos son del orden de 80–100 sitios sobre 760, y **se delatan solos**: la
auditoría de contraste que ya usamos en las cinco secciones anteriores los saca
por debajo de 3:1. No hay que revisar 37 archivos a ojo.

## 3. El mapeo de color

| Token de música | Hoy | Pasa a | Por qué |
|---|---|---|---|
| `ink` | `#0c0a09` | `paper` | era el fondo base |
| `ink-2` | `#15110f` | `paper-2` | fondo elevado |
| `ink-3` | `#1f1a17` | `paper-2` | solo hay dos papeles; se colapsa |
| `cream` | `#f4ede4` | `tinta` | era el texto primario |
| `cream-dim` | `#c4bdb2` | `tinta` | texto secundario |
| `mute` | `#6b6358` | `tinta` | texto terciario |
| `rule` | `#2a2521` | `line` | bordes |
| `acid` | `#d2ff3a` | `yellow` | el acento de la sección |
| `blood` | `#c1392b` | `peach` | el destructivo, como en todo el sistema |

**Los tres niveles de texto se colapsan en uno**, y es deliberado. `tinta-2` mide
4,00:1 y solo cubre texto grande; usarlo para los 214 `text-mute` dejaría media
sección por debajo de AA. Las otras cinco secciones ya tomaron ese mismo trade:
la jerarquía la dan el tamaño y el grosor, no el tono.

**Consecuencia asumida:** música va a leerse más pesada de lo que se lee hoy.

### Las etiquetas no se remapean: se miden

Los siete colores de etiqueta son una **paleta categórica**, como los tres
acentos de hábito, y siete no caben en seis pasteles: dos etiquetas acabarían
del mismo color y dejarían de distinguirse.

Se conservan los siete tonos y se **verifica que cada uno aguanta tinta encima**,
que es como se usan: cápsulas con texto. Medido:

| Etiqueta | Hoy | Con tinta | Queda en |
|---|---|---:|---|
| acid | `#d2ff3a` | 8,97:1 | sin cambio |
| amber | `#f4b942` | 5,88:1 | sin cambio |
| sky | `#6ed3ff` | 6,16:1 | sin cambio |
| mint | `#62e8aa` | 6,76:1 | sin cambio |
| **coral** | `#ff7a59` | **4,05:1** | `#ff9980` · 5,01:1 |
| **violet** | `#b18cff` | **4,00:1** | `#c2a5ff` · 5,01:1 |
| **rose** | `#ff6c9a` | **3,90:1** | `#ff93b5` · 5,00:1 |

Los tres que fallan se **aclaran**, no se oscurecen: la tinta es oscura, así que
el contraste sube alejando el fondo hacia el blanco. Se apunta a 5:1 y no al
4,5 justo para que un retoque futuro no lo rompa en silencio.

Siguen siendo siete y siguen distinguiéndose: el peor par tras el cambio es
coral~rose con **ΔE 30,6**, muy por encima del umbral de 20 que se le exigió a
los acentos de hábito con visión normal.

## 4. Las fuentes

| Token | Hoy | Pasa a |
|---|---|---|
| `--font-serif` | Fraunces | `--font-pixel` |
| `--font-mono` | JetBrains Mono | `--font-cuerpo` |

**`--font-mono` no pasa a VT323** aunque sea la fuente de datos del sistema: su
consumidor principal es `.label-mono`, que mide **10px**, y VT323 por debajo de
16 deja de leerse. La regla es explícita: lo que necesita ser más pequeño va en
Quicksand.

**La clase `.display` pierde sus `font-variation-settings`.** Ajustan los ejes
`opsz`, `SOFT` y `WONK` de Fraunces, que es variable; Press Start 2P no tiene
ejes y esas declaraciones no harían nada. Se quitan en vez de dejarlas mintiendo.

**Fraunces y JetBrains dejan de cargarse.** `src/app/musica/layout.tsx` es el
único sitio que las pide.

## 5. El ambiente

`.musica-root` monta hoy dos degradados radiales —un halo ácido y otro rojo— y
una capa de grano de película al 3,5%.

**Se quitan los dos.** Los halos eran resplandores para un mundo oscuro y sobre
papel no tienen sentido. El grano contradice el pixel art, que es plano por
definición: la textura del sistema es el papel y el trazo, no el ruido.

## 6. Qué no cambia

**Ninguna lógica, ningún dato, ninguna ruta.** Ni las consultas, ni la captura,
ni la sesión de Spotify.

**Los 428 tests siguen en verde sin modificar ninguno.**

**Las etiquetas conservan sus siete colores distinguibles** y su significado.

**El guard de sesión de `musica/layout.tsx` no se toca.** Es lo que protege la
sección, y cada server action conserva además el suyo.

**`.musica-root` sigue existiendo** como contenedor de la sección, aunque pierda
su ambiente: es donde se aplican las fuentes.

## 7. Riesgos

**El remapeo rompe entre 80 y 100 sitios a la vez.** Es intencionado y es la
apuesta de la estrategia: se rompen de golpe, se encuentran con la auditoría y
se arreglan por archivo. Pero entre el commit del remapeo y el último arreglo,
la sección está a medias.

**No puedo ver música renderizada.** Está tras el login de Spotify y el
navegador de la herramienta no tiene sesión. La auditoría de contraste hay que
ejecutarla **en el navegador del usuario**, o dar por hecho que quedan sitios
sin encontrar.

**Es la sección con más superficie por revisar.** Una tabla de 1.233 líneas, una
biblioteca de 573 y cuatro diálogos grandes. Aunque la auditoría guíe, hay que
recorrerla.

**`text-ink` y `bg-cream` son los dos patrones que se invierten.** Buscarlos por
grep antes de auditar ahorra la mitad del trabajo: son 24 y 17 usos localizables
sin abrir el navegador.

## 8. Criterios de aceptación

1. `npm run build`, `test`, `lint` y `tsc --noEmit` en verde
2. Los 428 tests pasan **sin que se haya modificado ninguno**
3. Ningún texto por debajo de 3:1 en las doce rutas de música
4. Los siete colores de etiqueta siguen siendo siete y distinguibles, y cada uno
   aguanta tinta encima con ≥ 4,5:1
5. Ningún pastel usado como color de texto
6. Press Start 2P nunca bajo 14px, VT323 nunca bajo 16px
7. Fraunces y JetBrains ya no se cargan
8. El resto del dashboard sigue funcionando

## 9. Fuera de alcance

- Cualquier cambio de lógica, datos, rutas o consultas
- Rediseñar la estructura de las pantallas de música
- Reducir el número de colores de etiqueta
- Modo claro/oscuro
