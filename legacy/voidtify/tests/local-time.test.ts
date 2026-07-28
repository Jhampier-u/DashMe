import { describe, expect, it } from "vitest";
import { localParts, resolveTimeZone } from "@/lib/stats/local-time";

describe("localParts", () => {
  it("desplaza al día anterior cuando la hora local va por detrás de UTC", () => {
    // 2019-03-15T03:30:00Z en Lima (UTC-5) son las 22:30 del día 14.
    const ts = Date.UTC(2019, 2, 15, 3, 30, 0);
    expect(localParts(ts, "America/Lima")).toEqual({
      localDate: "2019-03-14",
      localHour: 22,
    });
  });

  it("mantiene el día cuando no hay cruce de medianoche", () => {
    const ts = Date.UTC(2019, 2, 15, 18, 0, 0);
    expect(localParts(ts, "America/Lima")).toEqual({
      localDate: "2019-03-15",
      localHour: 13,
    });
  });

  it("aplica el horario de verano", () => {
    // Madrid: +1 en enero (CET), +2 en julio (CEST).
    const invierno = Date.UTC(2026, 0, 15, 0, 30, 0);
    const verano = Date.UTC(2026, 6, 15, 0, 30, 0);
    expect(localParts(invierno, "Europe/Madrid").localHour).toBe(1);
    expect(localParts(verano, "Europe/Madrid").localHour).toBe(2);
  });

  it("representa la medianoche como hora 0, no 24", () => {
    // Un formateador mal configurado devuelve "24" para medianoche.
    const ts = Date.UTC(2026, 6, 15, 0, 30, 0);
    expect(localParts(ts, "UTC")).toEqual({
      localDate: "2026-07-15",
      localHour: 0,
    });
  });

  it("rellena mes y día con ceros a la izquierda", () => {
    const ts = Date.UTC(2026, 0, 5, 12, 0, 0);
    expect(localParts(ts, "UTC").localDate).toBe("2026-01-05");
  });

  it("rechaza una zona horaria inválida", () => {
    expect(() => localParts(Date.now(), "No/Existe")).toThrow();
  });

  it("falla en vez de devolver 'undefined-undefined-undefined' con un timestamp inválido", () => {
    // new Date(ts) lanza RangeError antes de que se interpolen found.year/
    // found.month/found.day, así que un timestamp corrupto no puede colarse
    // en la base de datos como una fecha con apariencia válida.
    expect(() => localParts(NaN, "UTC")).toThrow(RangeError);
    expect(() => localParts(8.64e15 + 1, "UTC")).toThrow(RangeError);
  });

  it("aplica las reglas de zona horaria vigentes en el momento histórico, no las actuales", () => {
    // Chile: tras el terremoto de febrero de 2010 se pospuso el cambio de
    // horario de verano, así que a mitad de abril seguía en horario de
    // verano (UTC-4) en vez del UTC-3 habitual para esas fechas. Si el
    // motor de tzdata no aplica las reglas históricas correctas, este test
    // lo detecta.
    const chile = Date.UTC(2010, 3, 10, 12, 0, 0);
    expect(localParts(chile, "America/Santiago")).toEqual({
      localDate: "2010-04-10",
      localHour: 8,
    });

    // Rusia aplicaba horario de verano hasta 2011: en junio de 2010 Moscú
    // iba a UTC+4 y en diciembre de 2010 a UTC+3. Tras abolir el cambio de
    // horario, en junio de 2020 se mantiene en UTC+3 todo el año.
    const moscuVeranoConDst = Date.UTC(2010, 5, 15, 12, 0, 0);
    const moscuInviernoConDst = Date.UTC(2010, 11, 15, 12, 0, 0);
    const moscuVeranoSinDst = Date.UTC(2020, 5, 15, 12, 0, 0);
    expect(localParts(moscuVeranoConDst, "Europe/Moscow").localHour).toBe(16);
    expect(localParts(moscuInviernoConDst, "Europe/Moscow").localHour).toBe(
      15,
    );
    expect(localParts(moscuVeranoSinDst, "Europe/Moscow").localHour).toBe(15);
  });
});

describe("resolveTimeZone", () => {
  it("devuelve el valor de STATS_TZ", () => {
    expect(resolveTimeZone({ STATS_TZ: "Europe/Madrid" })).toBe(
      "Europe/Madrid",
    );
  });

  it("falla con un mensaje claro si STATS_TZ no está definida", () => {
    // Sin valor por defecto a propósito: una zona equivocada produce datos
    // que parecen correctos y no lo son.
    expect(() => resolveTimeZone({})).toThrow(/STATS_TZ/);
  });

  it("falla si STATS_TZ no es una zona válida", () => {
    expect(() => resolveTimeZone({ STATS_TZ: "No/Existe" })).toThrow(
      /STATS_TZ/,
    );
  });
});
