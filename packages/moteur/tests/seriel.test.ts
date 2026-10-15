import { describe, expect, it } from "vitest";
import { grilleTarif20Economique2022 } from "../src";
import { dec, somme } from "../src/decimal";
import { partageSeriel, type Demande } from "../src/seriel";
import { bornesTranches, coutEnergie } from "../src/tarif";

const tranches = bornesTranches(grilleTarif20Economique2022(3.3));

function demandes(kwh: number[], poids?: number[]): Demande[] {
  return kwh.map((q, i) => ({ kwh: dec(q), poids: dec(poids?.[i] ?? 1) }));
}

function montants(d: Demande[]): number[] {
  return partageSeriel(d, tranches).map((p) => p.montant.toNumber());
}

describe("partageSeriel", () => {
  it("reproduit l'exemple §6 de la spécification", () => {
    // A, B, C, D (sortant, 12 j), E (entrant, 18 j) — kWh écart compris
    const parts = partageSeriel(demandes([24, 64, 164, 19.6, 38.4], [1, 1, 1, 0.4, 0.6]), tranches);
    const m = parts.map((p) => p.montant.toNumber());
    expect(m[0]).toBeCloseTo(8160, 6);
    expect(m[1]).toBeCloseTo(28066.666667, 5);
    expect(m[2]).toBeCloseTo(86106.666667, 5);
    expect(m[3]).toBeCloseTo(7866.666667, 5);
    expect(m[4]).toBeCloseTo(16840, 6);

    const kwh = parts.map((p) => p.kwhParTranche.map((q) => q.toNumber()));
    expect(kwh[0]).toEqual([24, 0, 0]);
    expect(kwh[2][0]).toBeCloseTo(35.3333, 4);
    expect(kwh[2][1]).toBeCloseTo(118.6667, 4);
    expect(kwh[2][2]).toBeCloseTo(10, 6);
    expect(kwh[3][0]).toBeCloseTo(14.1333, 4);
    expect(kwh[3][1]).toBeCloseTo(5.4667, 4);
    expect(kwh[4]).toEqual([21.2, 17.2, 0]);
  });

  it("la somme des parts est égale au coût de la consommation totale", () => {
    const d = demandes([3, 17.5, 42, 0, 88, 150, 9]);
    const parts = partageSeriel(d, tranches);
    const total = somme(d.map((x) => x.kwh));
    expect(somme(parts.map((p) => p.montant)).toNumber()).toBeCloseTo(coutEnergie(total, tranches).toNumber(), 8);
    parts.forEach((p, i) => expect(somme(p.kwhParTranche).toNumber()).toBeCloseTo(d[i].kwh.toNumber(), 10));
  });

  it("ce que paie un foyer ne dépend pas de ceux qui consomment plus que lui", () => {
    const avant = montants(demandes([10, 30, 60]));
    const apres = montants(demandes([10, 30, 400]));
    expect(apres[0]).toBeCloseTo(avant[0], 8);
    expect(apres[1]).toBeCloseTo(avant[1], 8);
    expect(apres[2]).toBeGreaterThan(avant[2]);
  });

  it("un participant à 0 kWh ne paie rien et ne change rien pour les autres", () => {
    const sans = montants(demandes([20, 80, 150]));
    const avec = montants(demandes([20, 0, 80, 150]));
    expect(avec[1]).toBe(0);
    expect([avec[0], avec[2], avec[3]].map((x) => x.toFixed(6))).toEqual(sans.map((x) => x.toFixed(6)));
  });

  it("des consommations égales paient des montants égaux", () => {
    const m = montants(demandes([50, 50, 50, 50]));
    m.forEach((x) => expect(x).toBeCloseTo(m[0], 8));
  });

  it("tant que le bâtiment reste en tranche 1, chacun paie le prix de la tranche 1", () => {
    expect(montants(demandes([10, 40, 70]))).toEqual([3400, 13600, 23800]);
  });

  it("le poids de présence s'applique à la consommation par jour", () => {
    // Même consommation par jour de présence → même prix moyen.
    const m = montants(demandes([60, 30, 200], [1, 0.5, 1]));
    expect(m[0] / 60).toBeCloseTo(m[1] / 30, 8);
  });
});
