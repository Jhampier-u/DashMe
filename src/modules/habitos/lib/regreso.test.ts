import { describe, expect, it } from "vitest";
import { createTestDb } from "@/modules/core/db/testing";
import { habits, habitLogs, player } from "@/modules/habitos/schema";
import { cal } from "./calendario";
import { addDays, dayKey } from "./day";
import { toggleToday } from "./mutations";
import { XP_PER_HABIT } from "./level";
import { TECHO_REGRESO, XP_REGRESO, esRegreso } from "./regreso";

/** Julio de 2026. El 1 fue miércoles; el 5 y el 12, domingos. */
const D = (n: number) => new Date(Date.UTC(2026, 6, n));
const T = (n: number) => D(n).getTime();

const TODOS = cal("1111111", []);

describe("el bonus no puede hacer que fallar salga a cuenta", () => {
  it("es menor que lo que da el modo mínimo", () => {
    /*
      LA GARANTÍA QUE JUSTIFICA LA CONSTANTE, con los números reales:

        cumplir dos días en modo mínimo ... 12 + 12 = 24
        fallar uno y volver .............. 0 + 12 + 10 = 22

      Si el bonus subiera a 15, volver daría 27 y fallar pagaría MEJOR que
      cumplir a medias. Este test es lo que impide ese cambio.
    */
    expect(XP_REGRESO).toBeLessThan(TECHO_REGRESO);
  });

  it("y las cuentas salen en las dos direcciones", () => {
    const minimo = Math.floor(XP_PER_HABIT / 2);
    const dosAMedias = minimo + minimo;
    const fallarYVolverAMedias = 0 + minimo + XP_REGRESO;
    expect(fallarYVolverAMedias).toBeLessThan(dosAMedias);

    const dosEnteros = XP_PER_HABIT + XP_PER_HABIT;
    const fallarYVolverEntero = 0 + XP_PER_HABIT + XP_REGRESO;
    expect(fallarYVolverEntero).toBeLessThan(dosEnteros);
  });
});

describe("esRegreso", () => {
  it("lo es cuando el día programado anterior se falló", () => {
    // Cumplió el 8, falló el 9, vuelve el 10.
    const cumplidos = new Set([T(8), T(10)]);
    expect(esRegreso(TODOS, cumplidos, D(10))).toBe(true);
  });

  it("no lo es si ayer también se cumplió", () => {
    const cumplidos = new Set([T(9), T(10)]);
    expect(esRegreso(TODOS, cumplidos, D(10))).toBe(false);
  });

  it("estrenar el hábito NO es volver", () => {
    // Sin ningún día cumplido antes, el primero no es un regreso. Si no, cada
    // hábito nuevo pagaría el bonus el día que lo creas.
    expect(esRegreso(TODOS, new Set([T(10)]), D(10))).toBe(false);
  });

  it("lo es aunque la ausencia haya sido larga", () => {
    // Es justo el caso al que apunta la evidencia: volver tras semanas fuera.
    const cumplidos = new Set([T(1), T(30)]);
    expect(esRegreso(TODOS, cumplidos, D(30))).toBe(true);
  });

  it("un día que no tocaba no cuenta como fallo", () => {
    /*
      Sin domingos. Cumplió el sábado 4, el domingo 5 no tocaba, y vuelve el
      lunes 6: no ha fallado nada, así que no es un regreso.
    */
    const entreSemana = cal("0111111", []);
    const cumplidos = new Set([T(4), T(6)]);
    expect(esRegreso(entreSemana, cumplidos, D(6))).toBe(false);
  });

  it("un día en pausa tampoco", () => {
    // Unas vacaciones no son un fallo, así que volver de ellas no paga bonus.
    const conPausa = cal("1111111", [{ desde: D(9), hasta: D(9) }]);
    const cumplidos = new Set([T(8), T(10)]);
    expect(esRegreso(conPausa, cumplidos, D(10))).toBe(false);
  });

  it("un día salvado por un escudo tampoco", () => {
    /*
      Un escudo deja el día registrado como cumplido, así que llega aquí dentro
      de `cumplidos` y no dispara el regreso. Es correcto: el escudo ya hizo su
      trabajo, y pagar las dos cosas sería cobrar dos veces por el mismo día.
    */
    const cumplidos = new Set([T(8), T(9), T(10)]);
    expect(esRegreso(TODOS, cumplidos, D(10))).toBe(false);
  });

  it("sin ningún día cumplido no hay regreso posible", () => {
    expect(esRegreso(TODOS, new Set(), D(10))).toBe(false);
  });
});

/*
  LA PARTE QUE TOCA LA BASE. Lo de arriba es aritmética pura; esto comprueba que
  el bonus se concede cuando toca y —sobre todo— que se DEVUELVE al desmarcar.
  Si no se devolviera, marcar y desmarcar en bucle sería una máquina de XP.
*/
describe("el bonus contra la base", () => {
  async function conHabitoY(cumplidos: number[]) {
    const db = createTestDb();
    const hoy = dayKey();
    await db.insert(habits).values({
      id: "h1",
      name: "Leer",
      schedule: "1111111",
      createdAt: addDays(hoy, -30),
    });
    for (const d of cumplidos) {
      await db.insert(habitLogs).values({
        id: `l${d}`,
        habitId: "h1",
        date: addDays(hoy, -d),
        partial: false,
        xpAwarded: XP_PER_HABIT,
        createdAt: new Date(),
      });
    }
    return db;
  }

  async function xpDelRegistroDeHoy(
    db: Awaited<ReturnType<typeof conHabitoY>>,
  ) {
    const hoy = dayKey();
    const filas = await db.select().from(habitLogs);
    return filas.find((l) => l.date.getTime() === hoy.getTime())?.xpAwarded;
  }

  it("paga al volver tras fallar ayer", async () => {
    // Cumplió anteayer, falló ayer, marca hoy.
    const db = await conHabitoY([2]);
    const r = await toggleToday(db, "h1");
    expect(r.regreso).toEqual({ habitName: "Leer", bonus: XP_REGRESO });
    /*
      Se mira el `xpAwarded` grabado y no el `xpDelta` devuelto. El delta incluye
      el XP de las misiones diarias, que depende de la FECHA —`pickQuestsForDate`
      reparte tres de cinco— y de la hora. Afirmar sobre él ataría este test al
      reloj, que es justo el fallo que se corrigió en `mutations.test.ts`.
    */
    expect(await xpDelRegistroDeHoy(db)).toBe(XP_PER_HABIT + XP_REGRESO);
  });

  it("no paga si ayer también se cumplió", async () => {
    const db = await conHabitoY([1]);
    const r = await toggleToday(db, "h1");
    expect(r.regreso).toBeNull();
    expect(await xpDelRegistroDeHoy(db)).toBe(XP_PER_HABIT);
  });

  it("no paga al estrenar el hábito", async () => {
    const db = await conHabitoY([]);
    const r = await toggleToday(db, "h1");
    expect(r.regreso).toBeNull();
  });

  it("marcar y desmarcar sigue sumando CERO", async () => {
    /*
      La garantía de todo el bloque. El bonus se graba en `xpAwarded` igual que
      el del hito, así que al borrar el registro se devuelve exactamente lo
      concedido. Sin esto, un regreso sería XP infinito a golpe de clic.
    */
    const db = await conHabitoY([2]);
    const marcado = await toggleToday(db, "h1");
    expect(marcado.regreso).not.toBeNull();
    const desmarcado = await toggleToday(db, "h1");
    // La suma neta es cero pase lo que pase con las misiones: lo que se
    // devuelve es exactamente lo que se concedió.
    expect(marcado.xpDelta + desmarcado.xpDelta).toBe(0);
    const [p] = await db.select().from(player);
    expect(p.xp).toBe(0);
  });
});
