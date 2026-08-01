import { describe, expect, it } from "vitest";
import { getLevelInfo, levelFromXp } from "./level";

/*
  EL BLOQUE DE LA TIENDA. El nivel salía de `player.xp` en seis sitios, así que
  restar el precio de una decoración habría bajado de nivel: una tienda que te
  degrada por usarla no es una recompensa, es una multa.
*/
describe("el nivel sale de lo ganado, no del saldo", () => {
  it("gastar no baja el nivel", () => {
    const antes = getLevelInfo({ xp: 400, xpSpent: 0 });
    const despues = getLevelInfo({ xp: 50, xpSpent: 350 });
    expect(despues.level).toBe(antes.level);
    expect(despues.progress).toBe(antes.progress);
  });

  it("el saldo baja y lo ganado no", () => {
    const p = getLevelInfo({ xp: 50, xpSpent: 350 });
    expect(p.xp).toBe(50);
    expect(p.gastado).toBe(350);
    expect(p.ganado).toBe(400);
  });

  it("sin haber gastado nada se comporta igual que siempre", () => {
    // Criterio 7: un jardín sin nada comprado no nota que la tienda existe.
    const p = getLevelInfo({ xp: 400, xpSpent: 0 });
    expect(p.ganado).toBe(400);
    expect(p.level).toBe(levelFromXp(400));
  });

  it("un saldo negativo se trata como cero sin robar lo ganado", () => {
    const p = getLevelInfo({ xp: -10, xpSpent: 300 });
    expect(p.xp).toBe(0);
    expect(p.ganado).toBe(300);
  });
});
