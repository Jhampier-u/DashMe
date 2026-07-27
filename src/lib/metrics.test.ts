import { describe, it, expect } from "vitest";
import { dayKeyFromISO } from "./day";
import {
  averageRate,
  complianceSeries,
  rollingMean,
  type HabitSpec,
  type LogEntry,
} from "./metrics";

const key = (iso: string) => dayKeyFromISO(iso)!;
const DAILY = "1111111";
const MWF = "0101010"; // lun, mié, vie

function habit(id: string, schedule = DAILY, since = "2026-07-01"): HabitSpec {
  return { id, schedule, since: key(since) };
}

function log(
  habitId: string,
  iso: string,
  extra: Partial<LogEntry> = {},
): LogEntry {
  return { habitId, day: key(iso), partial: false, shielded: false, ...extra };
}

describe("complianceSeries", () => {
  it("cuenta cumplidos sobre programados", () => {
    const days = complianceSeries(
      [habit("a"), habit("b")],
      [log("a", "2026-07-20")],
      key("2026-07-20"),
      key("2026-07-20"),
    );
    expect(days).toHaveLength(1);
    expect(days[0]).toMatchObject({
      date: "2026-07-20",
      scheduled: 2,
      done: 1,
      rate: 0.5,
    });
  });

  it("no cuenta el hábito en días anteriores a su existencia", () => {
    const days = complianceSeries(
      [habit("a", DAILY, "2026-07-20")],
      [],
      key("2026-07-19"),
      key("2026-07-20"),
    );
    expect(days[0].scheduled).toBe(0);
    expect(days[0].rate).toBeNull();
    expect(days[1].scheduled).toBe(1);
  });

  it("excluye del promedio los días sin nada programado", () => {
    // Sábado 25: el hábito L-M-V no toca.
    const days = complianceSeries(
      [habit("a", MWF)],
      [],
      key("2026-07-25"),
      key("2026-07-25"),
    );
    expect(days[0].scheduled).toBe(0);
    expect(days[0].rate).toBeNull();
  });

  it("cuenta el modo mínimo como medio cumplimiento", () => {
    const days = complianceSeries(
      [habit("a"), habit("b")],
      [log("a", "2026-07-20", { partial: true })],
      key("2026-07-20"),
      key("2026-07-20"),
    );
    expect(days[0].done).toBe(0.5);
    expect(days[0].rate).toBe(0.25);
  });

  it("no da por cumplido un día cubierto por escudo, pero lo reporta", () => {
    const days = complianceSeries(
      [habit("a")],
      [log("a", "2026-07-20", { shielded: true })],
      key("2026-07-20"),
      key("2026-07-20"),
    );
    expect(days[0].done).toBe(0);
    expect(days[0].rate).toBe(0);
    expect(days[0].shielded).toBe(1);
  });

  it("ignora registros de días en los que el hábito no tocaba", () => {
    const days = complianceSeries(
      [habit("a", MWF)],
      [log("a", "2026-07-25")], // sábado
      key("2026-07-25"),
      key("2026-07-25"),
    );
    expect(days[0].scheduled).toBe(0);
    expect(days[0].done).toBe(0);
  });

  it("devuelve un elemento por día del rango, en orden", () => {
    const days = complianceSeries([habit("a")], [], key("2026-07-20"), key("2026-07-23"));
    expect(days.map((d) => d.date)).toEqual([
      "2026-07-20", "2026-07-21", "2026-07-22", "2026-07-23",
    ]);
  });
});

describe("rollingMean", () => {
  it("promedia la ventana que termina en cada punto", () => {
    expect(rollingMean([1, 2, 3, 4], 2)).toEqual([1, 1.5, 2.5, 3.5]);
  });

  it("usa los datos disponibles mientras la ventana no está llena", () => {
    expect(rollingMean([2, 4], 7)).toEqual([2, 3]);
  });

  it("ignora los huecos sin romper la media", () => {
    expect(rollingMean([1, null, 3], 3)).toEqual([1, 1, 2]);
  });

  it("devuelve null cuando la ventana entera es hueco", () => {
    expect(rollingMean([null, null], 2)).toEqual([null, null]);
  });
});

describe("averageRate", () => {
  it("promedia solo los días con algo programado", () => {
    expect(
      averageRate([
        { date: "a", scheduled: 2, done: 1, shielded: 0, rate: 0.5 },
        { date: "b", scheduled: 0, done: 0, shielded: 0, rate: null },
        { date: "c", scheduled: 1, done: 1, shielded: 0, rate: 1 },
      ]),
    ).toBe(0.75);
  });

  it("devuelve null si no hay ningún día con datos", () => {
    expect(
      averageRate([{ date: "a", scheduled: 0, done: 0, shielded: 0, rate: null }]),
    ).toBeNull();
  });
});
