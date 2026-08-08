import { describe, it, expect } from "vitest";
import { dayKeyFromISO } from "./day";
import {
  computeBestStreak,
  computeStreak,
  rachaDetallada,
  countScheduledDays,
  isCriticalDay,
  isScheduledOn,
  previousScheduledDay,
  sanitizeSchedule,
} from "./streak";
import { cal } from "./calendario";

const key = (iso: string) => dayKeyFromISO(iso)!;
const doneSet = (...isos: string[]) =>
  new Set(isos.map((iso) => key(iso).getTime()));

// Calendario de referencia:
//   2026-07-20 lun · 21 mar · 22 mié · 23 jue · 24 vie · 25 sáb · 26 dom · 27 lun
const DAILY = "1111111";
const MWF = "0101010"; // lun, mié, vie

describe("sanitizeSchedule", () => {
  it("rellena y recorta a 7 posiciones", () => {
    expect(sanitizeSchedule("101")).toBe("1010000");
    expect(sanitizeSchedule("11111111111")).toBe("1111111");
  });

  it("nunca deja un hábito sin días", () => {
    expect(sanitizeSchedule("0000000")).toBe(DAILY);
    expect(sanitizeSchedule("")).toBe(DAILY);
    expect(sanitizeSchedule(null)).toBe(DAILY);
    expect(sanitizeSchedule("xxxx")).toBe(DAILY);
  });
});

describe("isScheduledOn", () => {
  it("respeta los días marcados", () => {
    expect(isScheduledOn(MWF, key("2026-07-27"))).toBe(true); // lunes
    expect(isScheduledOn(MWF, key("2026-07-22"))).toBe(true); // miércoles
    expect(isScheduledOn(MWF, key("2026-07-25"))).toBe(false); // sábado
  });
});

describe("computeStreak · hábito diario", () => {
  const today = key("2026-07-27");

  it("cuenta los días consecutivos incluyendo hoy", () => {
    expect(
      computeStreak(
        cal(DAILY),
        doneSet("2026-07-25", "2026-07-26", "2026-07-27"),
        today,
      ),
    ).toBe(3);
  });

  it("no rompe la racha si hoy sigue pendiente", () => {
    // Tienes hasta medianoche: ayer y anteayer siguen contando.
    expect(
      computeStreak(cal(DAILY), doneSet("2026-07-25", "2026-07-26"), today),
    ).toBe(2);
  });

  it("aguanta UN hueco: el 26 falta y la racha sigue", () => {
    /*
      La regla cambió a propósito. Lally et al. (2010) dicen que saltarse una
      oportunidad suelta no deteriora la formación del hábito, así que ponerla a
      cero por un día representaba como catástrofe algo inocuo.

      El día perdonado NO suma: cumplidos el 27, 25 y 24 son 3, y el 26 se
      absorbe sin contarse.
    */
    expect(
      computeStreak(
        cal(DAILY),
        doneSet("2026-07-27", "2026-07-25", "2026-07-24"),
        today,
      ),
    ).toBe(3);
  });

  it("pero se corta con DOS huecos seguidos", () => {
    // Faltan el 25 y el 26. El segundo fallo sí rompe.
    expect(
      computeStreak(cal(DAILY), doneSet("2026-07-27", "2026-07-24"), today),
    ).toBe(1);
  });

  it("devuelve 0 sin historial", () => {
    expect(computeStreak(cal(DAILY), doneSet(), today)).toBe(0);
  });
});

describe("computeStreak · hábito L-M-V", () => {
  it("ignora los días que no tocan", () => {
    // Cumplido lun 20, mié 22, vie 24. El sábado la racha sigue viva en 3.
    const done = doneSet("2026-07-20", "2026-07-22", "2026-07-24");
    expect(computeStreak(cal(MWF), done, key("2026-07-25"))).toBe(3);
    expect(computeStreak(cal(MWF), done, key("2026-07-26"))).toBe(3);
  });

  it("perdona el miércoles 22 que falta, y cuenta los otros dos", () => {
    const done = doneSet("2026-07-20", "2026-07-24");
    expect(computeStreak(cal(MWF), done, key("2026-07-25"))).toBe(2);
  });

  it("y se rompe si faltan DOS días programados seguidos", () => {
    // Faltan el miércoles 22 y el viernes 24; solo queda el lunes 20.
    const done = doneSet("2026-07-20");
    expect(computeStreak(cal(MWF), done, key("2026-07-27"))).toBe(0);
  });

  it("sigue viva el lunes siguiente mientras no acabe el día", () => {
    const done = doneSet("2026-07-20", "2026-07-22", "2026-07-24");
    expect(computeStreak(cal(MWF), done, key("2026-07-27"))).toBe(3);
  });

  it("suma el día en curso al cumplirlo", () => {
    const done = doneSet(
      "2026-07-20",
      "2026-07-22",
      "2026-07-24",
      "2026-07-27",
    );
    expect(computeStreak(cal(MWF), done, key("2026-07-27"))).toBe(4);
  });
});

describe("computeBestStreak", () => {
  it("encuentra la mejor racha histórica", () => {
    const done = doneSet(
      "2026-07-01",
      "2026-07-02",
      "2026-07-03", // 3
      "2026-07-10",
      "2026-07-11",
      "2026-07-12",
      "2026-07-13", // 4
      "2026-07-20",
    );
    expect(
      computeBestStreak(cal(DAILY), done, key("2026-07-01"), key("2026-07-27")),
    ).toBe(4);
  });

  it("cuenta solo días programados", () => {
    // 4 sesiones L-M-V seguidas aunque haya fines de semana en medio.
    const done = doneSet(
      "2026-07-20",
      "2026-07-22",
      "2026-07-24",
      "2026-07-27",
    );
    expect(
      computeBestStreak(cal(MWF), done, key("2026-07-20"), key("2026-07-27")),
    ).toBe(4);
  });

  it("es 0 sin cumplimientos", () => {
    expect(
      computeBestStreak(
        cal(DAILY),
        doneSet(),
        key("2026-07-01"),
        key("2026-07-27"),
      ),
    ).toBe(0);
  });
});

describe("isCriticalDay", () => {
  it("avisa cuando fallaste el día programado anterior", () => {
    // Hoy lunes 27, el viernes 24 se falló.
    expect(
      isCriticalDay(cal(MWF), doneSet("2026-07-22"), key("2026-07-27"), true),
    ).toBe(true);
  });

  it("no avisa si el día anterior programado se cumplió", () => {
    expect(
      isCriticalDay(cal(MWF), doneSet("2026-07-24"), key("2026-07-27"), true),
    ).toBe(false);
  });

  it("no avisa si hoy no toca", () => {
    expect(isCriticalDay(cal(MWF), doneSet(), key("2026-07-25"), true)).toBe(
      false,
    );
  });

  it("no avisa si ya está hecho hoy", () => {
    expect(
      isCriticalDay(cal(MWF), doneSet("2026-07-27"), key("2026-07-27"), true),
    ).toBe(false);
  });

  it("no avisa en hábitos recién creados", () => {
    expect(isCriticalDay(cal(MWF), doneSet(), key("2026-07-27"), false)).toBe(
      false,
    );
  });
});

describe("previousScheduledDay", () => {
  it("salta los días que no tocan", () => {
    const prev = previousScheduledDay(cal(MWF), key("2026-07-27"));
    expect(prev?.getTime()).toBe(key("2026-07-24").getTime());
  });

  it("devuelve null si no hay ninguno en la ventana", () => {
    // Solo domingos; desde el miércoles 22 mirando 2 días atrás (mar, lun).
    expect(
      previousScheduledDay(cal("1000000"), key("2026-07-22"), 2),
    ).toBeNull();
  });
});

describe("countScheduledDays", () => {
  it("cuenta los días activos de la ventana", () => {
    expect(
      countScheduledDays(cal(DAILY), key("2026-07-21"), key("2026-07-27")),
    ).toBe(7);
    expect(
      countScheduledDays(cal(MWF), key("2026-07-21"), key("2026-07-27")),
    ).toBe(3);
  });
});

describe("las pausas no rompen la racha", () => {
  /*
    Las dos juntas son la prueba de que la pausa hace algo: la segunda muestra que
    sin ella el mismo hueco corta. Una sola no demostraría nada.
  */
  it("un hueco en pausa vuelve a unir los dos lados", () => {
    const hechos = doneSet("2026-07-25", "2026-07-28");
    const pausa = [{ desde: key("2026-07-26"), hasta: key("2026-07-27") }];
    expect(computeStreak(cal(DAILY, pausa), hechos, key("2026-07-28"))).toBe(2);
  });

  it("sin la pausa, ese mismo hueco corta", () => {
    const hechos = doneSet("2026-07-25", "2026-07-28");
    expect(computeStreak(cal(DAILY), hechos, key("2026-07-28"))).toBe(1);
  });
});

describe("rachaDetallada dice cuántos fallos ha absorbido", () => {
  const today = key("2026-07-27");

  it("cero cuando la racha está limpia", () => {
    const done = doneSet("2026-07-27", "2026-07-26", "2026-07-25");
    expect(rachaDetallada(cal(DAILY), done, today)).toEqual({
      dias: 3,
      perdonados: 0,
    });
  });

  it("uno cuando ha absorbido un fallo", () => {
    /*
      Esto es lo que hace honesta la gracia. La racha dice 3 y ha perdonado 1, y
      la pantalla puede decir las dos cosas. Enseñar un 3 limpio sería
      exactamente la mentira de representación que Silverman y Barasch (2022)
      miden: el efecto de la racha depende de lo que el registro ENSEÑA, no de lo
      que hiciste.
    */
    const done = doneSet("2026-07-27", "2026-07-25", "2026-07-24");
    expect(rachaDetallada(cal(DAILY), done, today)).toEqual({
      dias: 3,
      perdonados: 1,
    });
  });

  it("no anuncia un perdón si no hay racha que sostener", () => {
    // Sin un solo día cumplido, `perdonados` tiene que ser 0: perdonar algo que
    // nunca empezó sería inventarse un mérito.
    expect(rachaDetallada(cal(DAILY), doneSet(), today)).toEqual({
      dias: 0,
      perdonados: 0,
    });
  });

  it("la mejor racha histórica usa la MISMA gracia", () => {
    /*
      Si la actual perdonara y la histórica no, la racha de hoy podría superar a
      la «mejor de siempre». Sería una incoherencia visible en pantalla y sin
      explicación posible.
    */
    const done = doneSet("2026-07-20", "2026-07-22", "2026-07-23");
    const actual = computeStreak(cal(DAILY), done, key("2026-07-23"));
    const mejor = computeBestStreak(
      cal(DAILY),
      done,
      key("2026-07-01"),
      key("2026-07-23"),
    );
    expect(mejor).toBeGreaterThanOrEqual(actual);
  });
});
