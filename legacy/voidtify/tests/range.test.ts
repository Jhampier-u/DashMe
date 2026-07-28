import { describe, expect, it } from "vitest";
import { parseRange, PRESETS } from "@/lib/stats/range";

// 2026-07-27T12:00:00Z. En America/Guayaquil (UTC-5) son las 07:00 del día 27.
const AHORA = Date.UTC(2026, 6, 27, 12, 0, 0);
const TZ = "America/Guayaquil";

describe("presets", () => {
  it("por defecto devuelve las últimas 4 semanas en días locales", () => {
    const r = parseRange({}, AHORA, TZ);
    expect(r.toDate).toBe("2026-07-27");
    // 30 jun → 27 jul son 28 días contando ambos extremos.
    expect(r.fromDate).toBe("2026-06-30");
    expect(r.preset).toBe("4w");
    expect(r.label).toBe(PRESETS["4w"].label);
  });

  it("resuelve el preset de 6 meses", () => {
    const r = parseRange({ preset: "6m" }, AHORA, TZ);
    expect(r.toDate).toBe("2026-07-27");
    // 27 ene → 27 jul son 182 días contando ambos extremos.
    expect(r.fromDate).toBe("2026-01-27");
    expect(r.preset).toBe("6m");
  });

  it("resuelve el preset de un año", () => {
    const r = parseRange({ preset: "year" }, AHORA, TZ);
    expect(r.toDate).toBe("2026-07-27");
    // 28 jul 2025 → 27 jul 2026 son 365 días contando ambos extremos.
    expect(r.fromDate).toBe("2025-07-28");
    expect(r.preset).toBe("year");
  });

  it("cada preset cubre exactamente los días que promete su nombre", () => {
    // Ancla la aritmética de extremos inclusivos: si alguien cambia `days`
    // sin pensar, esto se rompe antes de que las cifras salgan mal en la UI.
    const dias = (r: { fromDate: string; toDate: string }) =>
      Math.round(
        (Date.parse(`${r.toDate}T12:00:00Z`) -
          Date.parse(`${r.fromDate}T12:00:00Z`)) /
          86_400_000,
      ) + 1;

    expect(dias(parseRange({ preset: "4w" }, AHORA, TZ))).toBe(28);
    expect(dias(parseRange({ preset: "6m" }, AHORA, TZ))).toBe(182);
    expect(dias(parseRange({ preset: "year" }, AHORA, TZ))).toBe(365);
  });

  it("el preset histórico empieza en 1970", () => {
    const r = parseRange({ preset: "all" }, AHORA, TZ);
    expect(r.fromDate).toBe("1970-01-01");
    expect(r.toDate).toBe("2026-07-27");
  });

  it("usa el día local, no el día UTC", () => {
    // 2026-07-27T02:00:00Z son las 21:00 del día 26 en Guayaquil.
    const madrugada = Date.UTC(2026, 6, 27, 2, 0, 0);
    expect(parseRange({}, madrugada, TZ).toDate).toBe("2026-07-26");
    expect(parseRange({}, madrugada, "UTC").toDate).toBe("2026-07-27");
  });
});

describe("rangos personalizados", () => {
  it("acepta un rango explícito y lo devuelve tal cual", () => {
    const r = parseRange({ desde: "2019-03-01", hasta: "2019-07-31" }, AHORA, TZ);
    expect(r.fromDate).toBe("2019-03-01");
    expect(r.toDate).toBe("2019-07-31");
    expect(r.preset).toBe("custom");
  });

  it("tiene prioridad sobre el preset", () => {
    const r = parseRange(
      { preset: "6m", desde: "2019-03-01", hasta: "2019-03-31" },
      AHORA,
      TZ,
    );
    expect(r.preset).toBe("custom");
  });

  it("intercambia las fechas si vienen al revés", () => {
    const r = parseRange({ desde: "2019-07-31", hasta: "2019-03-01" }, AHORA, TZ);
    expect(r.fromDate).toBe("2019-03-01");
    expect(r.toDate).toBe("2019-07-31");
  });

  it("la etiqueta refleja el rango real, no la entrada cruda", () => {
    const r = parseRange({ desde: "2019-07-31", hasta: "2019-03-01" }, AHORA, TZ);
    expect(r.label).toBe("2019-03-01 → 2019-07-31");
  });

  it("admite un rango de un solo día", () => {
    const r = parseRange({ desde: "2019-03-01", hasta: "2019-03-01" }, AHORA, TZ);
    expect(r.fromDate).toBe("2019-03-01");
    expect(r.toDate).toBe("2019-03-01");
  });
});

describe("entradas inválidas", () => {
  it("cae al preset por defecto si las fechas no tienen el formato", () => {
    expect(parseRange({ desde: "no-es-fecha", hasta: "tampoco" }, AHORA, TZ).preset)
      .toBe("4w");
  });

  it("rechaza una fecha que no existe en el calendario", () => {
    // Date.UTC(2019, 1, 30) desborda silenciosamente al 2 de marzo.
    expect(parseRange({ desde: "2019-02-30", hasta: "2019-03-31" }, AHORA, TZ).preset)
      .toBe("4w");
    expect(parseRange({ desde: "2019-13-01", hasta: "2019-12-31" }, AHORA, TZ).preset)
      .toBe("4w");
    expect(parseRange({ desde: "2019-04-31", hasta: "2019-05-31" }, AHORA, TZ).preset)
      .toBe("4w");
  });

  it("acepta el 29 de febrero en año bisiesto", () => {
    const r = parseRange({ desde: "2020-02-29", hasta: "2020-03-01" }, AHORA, TZ);
    expect(r.preset).toBe("custom");
    expect(r.fromDate).toBe("2020-02-29");
  });

  it("rechaza el 29 de febrero en año no bisiesto", () => {
    expect(parseRange({ desde: "2019-02-29", hasta: "2019-03-01" }, AHORA, TZ).preset)
      .toBe("4w");
  });

  it("ignora un rango con solo una de las dos fechas", () => {
    expect(parseRange({ desde: "2019-03-01" }, AHORA, TZ).preset).toBe("4w");
    expect(parseRange({ hasta: "2019-03-01" }, AHORA, TZ).preset).toBe("4w");
  });

  it("cae al preset por defecto si el preset no existe", () => {
    expect(parseRange({ preset: "inventado" }, AHORA, TZ).preset).toBe("4w");
  });

  it("no deja pasar claves heredadas del prototipo", () => {
    // `preset in PRESETS` las dejaba pasar y producía from: NaN, label: undefined.
    for (const clave of ["constructor", "toString", "hasOwnProperty", "valueOf"]) {
      const r = parseRange({ preset: clave }, AHORA, TZ);
      expect(r.preset).toBe("4w");
      expect(r.label).toBe(PRESETS["4w"].label);
      expect(r.fromDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe("zonas con horario de verano", () => {
  // El preset debe caer en el mismo día de calendario que se obtiene restando
  // días sobre la fecha local, no restando milisegundos sobre el instante.
  function restaDeCalendario(localDate: string, days: number): string {
    const [y, m, d] = localDate.split("-").map(Number);
    const v = new Date(Date.UTC(y, m - 1, d) - days * 86_400_000);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${v.getUTCFullYear()}-${p(v.getUTCMonth() + 1)}-${p(v.getUTCDate())}`;
  }

  it("no se desplaza al cruzar un cambio de hora en Madrid", () => {
    // 2026-01-01T22:00:00Z son las 23:00 del 1 de enero en Madrid (CET, +1).
    // Restar 181 días en milisegundos cruza el cambio a CEST y cae un día tarde.
    const ahora = Date.UTC(2026, 0, 1, 22, 0, 0);
    const r = parseRange({ preset: "6m" }, ahora, "Europe/Madrid");

    expect(r.toDate).toBe("2026-01-01");
    expect(r.fromDate).toBe(restaDeCalendario("2026-01-01", 181));
    expect(r.fromDate).toBe("2025-07-04");
  });

  it("no se desplaza en Santiago, que cambia la hora en sentido opuesto", () => {
    const ahora = Date.UTC(2026, 6, 1, 3, 0, 0);
    const r = parseRange({ preset: "6m" }, ahora, "America/Santiago");
    expect(r.fromDate).toBe(restaDeCalendario(r.toDate, 181));
  });

  it("los presets cubren los días prometidos en cualquier zona", () => {
    const dias = (r: { fromDate: string; toDate: string }) =>
      Math.round(
        (Date.parse(`${r.toDate}T12:00:00Z`) -
          Date.parse(`${r.fromDate}T12:00:00Z`)) /
          86_400_000,
      ) + 1;

    for (const tz of ["Europe/Madrid", "America/Santiago", "Pacific/Auckland"]) {
      // Se recorre un año entero de instantes para atrapar cualquier cruce.
      for (let dia = 0; dia < 365; dia += 7) {
        const ahora = Date.UTC(2026, 0, 1, 22, 0, 0) + dia * 86_400_000;
        expect(dias(parseRange({ preset: "4w" }, ahora, tz))).toBe(28);
        expect(dias(parseRange({ preset: "6m" }, ahora, tz))).toBe(182);
        expect(dias(parseRange({ preset: "year" }, ahora, tz))).toBe(365);
      }
    }
  });
});
