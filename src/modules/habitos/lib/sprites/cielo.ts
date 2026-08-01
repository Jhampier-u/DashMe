/*
  El cielo: sol, luna, amanecer y nubes. Mismo formato que las plantas, pero en
  rejilla de 12×12 — son elementos de fondo y no necesitan el detalle de una
  planta.

  Estos dibujos NO deciden nada. Qué se pinta lo siguen decidiendo la hora real y
  el tiempo de la semana, exactamente igual que antes; aquí solo cambia el trazo.
*/

/** El sol: disco ámbar con rayos. */
export const SOL = `
..a......a..
...a....a...
....aaaa....
...aAAAAa...
..aAAAAAAa..
.aAAAAAAAAa.
.aAAAAAAAAa.
..aAAAAAAa..
...aAAAAa...
....aaaa....
...a....a...
..a......a..
`;

/** La luna: creciente en lavanda con dos estrellas. */
export const LUNA = `
.....llll...
...lllLLLl..
..llLLL..l..
..lLLL......
.llLLL.....p
.llLLL......
.llLLL...p..
..lLLL......
..llLLL..p..
...lllLLLl..
.....llll...
............
`;

/** Amanecer y atardecer: medio sol sobre el horizonte. */
export const AURORA = `
............
............
....aaaa....
...aAAAAa...
..aAAAAAAa..
.aAAAAAAAAa.
.aAAAAAAAAa.
aaAAAAAAAAaa
............
.rrrrrrrrrr.
............
..RRRRRRRR..
`;

/** Una nube. Papel con filo, para que se recorte sobre cualquier cielo. */
export const NUBE = `
............
............
....pppp....
..ppPPPPpp..
.pPPPPPPPPp.
pPPPPPPPPPPp
pPPPPPPPPPPp
.pppppppppp.
............
............
............
............
`;

/**
 * Una nube de lluvia: más oscura y con tres gotas.
 *
 * Se distingue de la nube normal por la FORMA —las gotas— y no solo por el tono,
 * que es la regla de todo este rediseño.
 */
export const NUBE_LLUVIA = `
............
....pppp....
..ppPPPPpp..
.pPPPPPPPPp.
pPPPPPPPPPPp
pPPPPPPPPPPp
.pppppppppp.
..c...c...c.
..c...c...c.
...c...c....
............
............
`;

/*
  Los dos distintivos de una planta. Rejilla de 8×8: son marcas pequeñas que se
  pintan encima, no elementos de la escena.
*/

/** La corona del hábito ancla. */
export const CORONA = `
a.a.a.a.
aaaaaaaa
aAAAAAAa
aAAAAAAa
.aaaaaa.
........
........
........
`;

/** El destello de una racha de 7 días o más. */
export const DESTELLO = `
...aa...
...aa...
.a.aa.a.
..aaaa..
aaaaaaaa
..aaaa..
.a.aa.a.
...aa...
`;
