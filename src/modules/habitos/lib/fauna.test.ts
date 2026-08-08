import { describe, expect, it } from "vitest";
import { parseSprite } from "@/modules/core/ui/pixel/rejilla";
import { MARIPOSA, PAJARO } from "./sprites/fauna";
import {
  MAX_MARIPOSAS,
  MAX_PAJAROS,
  faunaEn,
  fraseDeFauna,
  mariposasPara,
  pajarosPara,
  mezclarFauna,
  haySeñalDeMusica,
  type DiaDeFauna,
} from "./fauna";

const D = (n: number) => new Date(Date.UTC(2026, 7, n));
const dia = (n: number, minutos: number, tareas: number): DiaDeFauna => ({
  dia: D(n).getTime(),
  minutos,
  tareas,
});

describe("pajarosPara", () => {
  it("sin música no hay ningún pájaro", () => {
    /*
      Criterio 1, y la regla del bloque. Un día sin música no se rellena con un
      pájaro suelto para que el cielo no parezca vacío: si el día estuvo vacío,
      la escena lo dice.
    */
    expect(pajarosPara(0)).toBe(0);
  });

  it("recorre los tramos de la tabla", () => {
    expect(pajarosPara(1)).toBe(1);
    expect(pajarosPara(29)).toBe(1);
    expect(pajarosPara(30)).toBe(2);
    expect(pajarosPara(89)).toBe(2);
    expect(pajarosPara(90)).toBe(3);
    expect(pajarosPara(179)).toBe(3);
    expect(pajarosPara(180)).toBe(4);
  });

  it("no pasa del tope por mucho que escuches", () => {
    // Criterio 3. La diferencia entre nueve y diez pájaros no la ve nadie.
    expect(pajarosPara(10_000)).toBe(MAX_PAJAROS);
  });

  it("aguanta un número imposible sin inventarse fauna", () => {
    /*
      Infinito da CERO y no el tope, que es lo contrario de lo que parece. Un
      número imposible no es «escuchaste muchísimo»: es un dato roto, y la regla
      del módulo es no inventar fauna. Llenar el cielo de pájaros por una fila
      corrupta sería afirmar algo sobre tu día que nadie sabe.
    */
    expect(pajarosPara(-5)).toBe(0);
    expect(pajarosPara(Number.NaN)).toBe(0);
    expect(pajarosPara(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("mariposasPara", () => {
  it("sin tareas cerradas no hay ninguna", () => {
    // Criterio 2.
    expect(mariposasPara(0)).toBe(0);
  });

  it("una por tarea", () => {
    expect(mariposasPara(1)).toBe(1);
    expect(mariposasPara(3)).toBe(3);
  });

  it("se para en el tope aunque cierres veinte", () => {
    // Criterio 4: veinte mariposas taparían las plantas, que es lo que importa.
    expect(mariposasPara(20)).toBe(MAX_MARIPOSAS);
  });

  it("aguanta un número imposible", () => {
    expect(mariposasPara(-3)).toBe(0);
    expect(mariposasPara(Number.NaN)).toBe(0);
  });
});

describe("faunaEn", () => {
  const dias = [dia(1, 45, 2), dia(2, 0, 0), dia(3, 300, 9)];

  it("da la fauna del día que se le pide", () => {
    // Criterio 6: al viajar a un día, la fauna es la de ESE día.
    expect(faunaEn(dias, D(1))).toEqual({ pajaros: 2, mariposas: 2 });
    expect(faunaEn(dias, D(3))).toEqual({ pajaros: 4, mariposas: 5 });
  });

  it("un día del que no se sabe nada no tiene fauna", () => {
    // Criterio 7: sin datos, el jardín se ve como antes.
    expect(faunaEn(dias, D(9))).toEqual({ pajaros: 0, mariposas: 0 });
    expect(faunaEn([], D(1))).toEqual({ pajaros: 0, mariposas: 0 });
  });

  it("un día registrado a cero tampoco", () => {
    // Que exista la fila no significa que pasara algo.
    expect(faunaEn(dias, D(2))).toEqual({ pajaros: 0, mariposas: 0 });
  });
});

describe("fraseDeFauna", () => {
  it("dice los minutos y las tareas", () => {
    // Criterio 5: el recuento se puede LEER. Un bicho pequeño y en movimiento
    // es de lo peor que se le puede pedir a la vista.
    expect(fraseDeFauna([dia(1, 43, 2)], D(1))).toBe(
      "43 min de música · 2 tareas cerradas",
    );
  });

  it("pone la tarea en singular cuando es una", () => {
    expect(fraseDeFauna([dia(1, 0, 1)], D(1))).toBe("1 tarea cerrada");
  });

  it("calla lo que fue cero en vez de decir «0 tareas»", () => {
    expect(fraseDeFauna([dia(1, 43, 0)], D(1))).toBe("43 min de música");
  });

  it("habla del REGISTRO, no de tu día", () => {
    /*
      «Registradas» y no «hubo». Es lo único que el dashboard puede saber, y la
      diferencia importa: un hueco vacío parece un fallo de carga, y una
      afirmación sobre tu día que no podemos sostener es peor todavía.
    */
    expect(fraseDeFauna([dia(1, 30, 0)], D(9))).toBe(
      "Sin música ni tareas registradas.",
    );
  });

  it("distingue «no escuchaste» de «no tengo datos»", () => {
    /*
      LA DEGRADACIÓN ELEGANTE. Skog et al. rompían su plantilla artística a
      propósito cuando el servidor caía, para que se notara. Aquí «cero
      pájaros» significaba dos cosas distintas —no escuchaste, y no lo sé— y se
      veían idénticas. Ahora, sin una sola señal de música en todo el tramo, se
      dice que el problema puede ser la conexión.
    */
    expect(fraseDeFauna([dia(1, 0, 2)], D(9), true)).toBe(
      "Sin datos de música. Puede que Spotify no esté conectado.",
    );
  });

  it("redondea los minutos en vez de enseñar decimales", () => {
    expect(fraseDeFauna([dia(1, 43.7, 0)], D(1))).toBe("44 min de música");
  });
});

describe("los sprites de la fauna", () => {
  it("se pueden dibujar, y sin letras inventadas", () => {
    expect(() => parseSprite(PAJARO)).not.toThrow();
    expect(() => parseSprite(MARIPOSA)).not.toThrow();
  });
});

describe("mezclarFauna", () => {
  it("junta las escuchas y las tareas del mismo día en una fila", () => {
    const r = mezclarFauna(
      [{ dia: D(1).getTime(), ms: 1_800_000 }],
      [D(1).getTime(), D(1).getTime()],
    );
    expect(r).toEqual([{ dia: D(1).getTime(), minutos: 30, tareas: 2 }]);
  });

  it("un día con música y sin tareas sale con cero tareas, no ausente", () => {
    const r = mezclarFauna([{ dia: D(2).getTime(), ms: 60_000 }], []);
    expect(r).toEqual([{ dia: D(2).getTime(), minutos: 1, tareas: 0 }]);
  });

  it("y al revés", () => {
    const r = mezclarFauna([], [D(3).getTime()]);
    expect(r).toEqual([{ dia: D(3).getTime(), minutos: 0, tareas: 1 }]);
  });

  it("los devuelve en orden de día", () => {
    const r = mezclarFauna(
      [
        { dia: D(5).getTime(), ms: 0 },
        { dia: D(1).getTime(), ms: 0 },
      ],
      [D(3).getTime()],
    );
    expect(r.map((x) => x.dia)).toEqual(
      [D(1), D(3), D(5)].map((d) => d.getTime()),
    );
  });

  it("sin nada de nada devuelve una lista vacía", () => {
    // Criterio 7: sin música ni tareas, el jardín se ve como antes.
    expect(mezclarFauna([], [])).toEqual([]);
  });

  it("un `ms` negativo no resta minutos a un día", () => {
    // Una fila corrupta no puede hacer que un día con música parezca vacío.
    const r = mezclarFauna(
      [
        { dia: D(1).getTime(), ms: 600_000 },
        { dia: D(1).getTime(), ms: -600_000 },
      ],
      [],
    );
    expect(r[0].minutos).toBe(10);
  });
});

describe("haySeñalDeMusica", () => {
  it("es falso cuando no hay un solo minuto en todo el tramo", () => {
    expect(haySeñalDeMusica([dia(1, 0, 3), dia(2, 0, 1)])).toBe(false);
    expect(haySeñalDeMusica([])).toBe(false);
  });

  it("basta un día con música para no dar la alarma", () => {
    // Dejar de escuchar una temporada es normal y NO es un fallo de conexión.
    expect(haySeñalDeMusica([dia(1, 12, 0), dia(2, 0, 0)])).toBe(true);
  });
});
