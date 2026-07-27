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
