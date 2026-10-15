import { describe, expect, it } from "vitest";
import { calculerFacture, repartirCycle, type EntreeCycle } from "../src";
import { dec } from "../src/decimal";
import { repartirFranchise } from "../src/repartition";
import { exempleSpecification } from "./donnees";

const codes = (r: ReturnType<typeof repartirCycle>) => r.diagnostics.map((d) => `${d.niveau}:${d.code}`);
const sommeArrondis = (r: ReturnType<typeof repartirCycle>) =>
  Math.round(r.participants.reduce((s, p) => s + p.totalArrondi, 0) * 100) / 100;

describe("repartirCycle — exemple §6 de la spécification", () => {
  const r = repartirCycle(exempleSpecification());
  const parId = Object.fromEntries(r.participants.map((p) => [p.occupantId, p]));

  it("est valide et contrôle la facture", () => {
    expect(r.ok).toBe(true);
    expect(r.joursCycle).toBe(30);
    expect(r.controleFacture).toEqual({ totalSaisi: 200462.8, totalRecalcule: 200462.8, difference: 0, coherent: true });
    expect(r.facture?.tva).toBe(27743.8);
  });

  it("calcule l'écart et le répartit selon la présence", () => {
    expect(r.ecart).toEqual({
      compteurPrincipalKwh: 310,
      sommeParticipantsKwh: 294,
      nonAttribueKwh: 2,
      ecartKwh: 16,
      ecartRelatif: 16 / 310,
      mode: "egal",
    });
    expect(["A", "B", "C", "D", "E"].map((id) => parId[id].kwhCorriges)).toEqual([24, 64, 164, 19.6, 38.4]);
  });

  it("retrouve le tableau du §6 au centime", () => {
    const attendu: Record<string, [number, number, number, number, number, number]> = {
      //   énergie    taxes    fixes    franchise  TVA       total
      A: [8160.0, 428.4, 4489.85, 8500, 915.65, 13993.9],
      B: [28066.67, 1473.5, 4489.85, 8500, 5106.0, 39136.02],
      C: [86106.67, 4520.6, 4489.85, 8500, 17323.42, 112440.54],
      D: [7866.67, 413.0, 1795.94, 3400, 1335.12, 11410.73],
      E: [16840.0, 884.1, 2693.91, 5100, 3063.6, 23481.61],
    };
    for (const [id, [energie, taxes, fixes, franchise, tva, total]] of Object.entries(attendu)) {
      const p = parId[id];
      expect(p.energie).toBeCloseTo(energie, 2);
      expect(p.totalTaxes).toBeCloseTo(taxes, 2);
      expect(p.totalFraisFixes).toBeCloseTo(fixes, 2);
      expect(p.franchiseTva).toBeCloseTo(franchise, 2);
      expect(p.tva).toBeCloseTo(tva, 2);
      expect(p.totalArrondi).toBe(total);
      expect(p.ajustement).toBeCloseTo(0, 8);
    }
    expect(sommeArrondis(r)).toBe(200462.8);
    expect(r.totaux?.reliquatArrondi).toBe(0);
  });

  it("donne les kWh par tranche de chaque foyer", () => {
    expect(parId.A.kwhParTranche).toEqual([24, 0, 0]);
    expect(parId.C.kwhParTranche[2]).toBeCloseTo(10, 8);
    const t = [0, 1, 2].map((i) => r.participants.reduce((s, p) => s + p.kwhParTranche[i], 0));
    expect(t[0]).toBeCloseTo(130, 8);
    expect(t[1]).toBeCloseTo(170, 8);
    expect(t[2]).toBeCloseTo(10, 8);
  });

  it("indique ce que chaque foyer paierait avec son propre compteur", () => {
    expect(parId.A.totalSiCompteurIndividuel).toBe(calculerFacture(20, exempleSpecification().grille).total);
    expect(parId.A.totalSiCompteurIndividuel).toBe(28779.68);
  });
});

describe("repartirCycle — arrondis", () => {
  it("arrondit à l'Ariary par la méthode du plus fort reste", () => {
    const entree = exempleSpecification();
    const r = repartirCycle({ ...entree, parametres: { pasArrondi: 1 } });
    expect(r.participants.map((p) => p.totalArrondi)).toEqual([13994, 39136, 112440, 11411, 23482]);
    expect(r.totaux?.totalArrondi).toBe(200463);
    expect(r.totaux?.reliquatArrondi).toBeCloseTo(-0.2, 8);
  });
});

describe("repartirCycle — écart", () => {
  function avecIndexFin(kwhFactures: number, totalSaisi: number): EntreeCycle {
    const e = exempleSpecification();
    return {
      ...e,
      cycle: { ...e.cycle, indexPrincipalFin: 30400 + kwhFactures, totalFactureSaisi: totalSaisi },
    };
  }

  it("un écart négatif réduit chaque foyer proportionnellement", () => {
    const facture = calculerFacture(280, exempleSpecification().grille);
    const r = repartirCycle({ ...avecIndexFin(280, facture.total), parametres: { pasArrondi: 0.01, forcerEcart: true } });
    expect(r.ecart?.mode).toBe("proportionnel");
    expect(r.participants[0].kwhCorriges).toBeCloseTo((20 * 280) / 294, 10);
    expect(r.participants.reduce((s, p) => s + p.kwhCorriges, 0)).toBeCloseTo(280, 10);
    expect(codes(r)).toContain("avertissement:ECART_NEGATIF");
    expect(sommeArrondis(r)).toBe(facture.total);
  });

  it("un écart au-delà du seuil bloque la validation, sauf si l'admin force", () => {
    const facture = calculerFacture(340, exempleSpecification().grille);
    const bloque = repartirCycle(avecIndexFin(340, facture.total));
    expect(bloque.ok).toBe(false);
    expect(codes(bloque)).toContain("erreur:ECART_ELEVE");
    expect(bloque.participants).toHaveLength(5); // aperçu quand même

    const force = repartirCycle({ ...avecIndexFin(340, facture.total), parametres: { forcerEcart: true } });
    expect(force.ok).toBe(true);
    expect(codes(force)).toContain("avertissement:ECART_ELEVE");
  });
});

describe("repartirCycle — facture saisie", () => {
  it("une facture saisie incohérente bloque la validation", () => {
    const e = exempleSpecification();
    const r = repartirCycle({ ...e, cycle: { ...e.cycle, totalFactureSaisi: 201000 } });
    expect(r.ok).toBe(false);
    expect(codes(r)).toContain("erreur:FACTURE_INCOHERENTE");
  });

  it("si l'admin force, la différence est répartie au prorata et le total saisi est respecté", () => {
    const e = exempleSpecification();
    const r = repartirCycle({ ...e, cycle: { ...e.cycle, totalFactureSaisi: 201000 }, parametres: { pasArrondi: 0.01, forcerFacture: true } });
    expect(r.ok).toBe(true);
    expect(r.totaux?.ajustement).toBeCloseTo(537.2, 8);
    expect(sommeArrondis(r)).toBe(201000);
    const c = r.participants.find((p) => p.occupantId === "C")!;
    expect(c.ajustement).toBeCloseTo((537.2 * 112440.54) / 200462.8, 4);
  });
});

describe("repartirCycle — foyer absent tout le cycle (vacances)", () => {
  const e = exempleSpecification();
  const entree: EntreeCycle = {
    ...e,
    occupations: [...e.occupations, { occupantId: "F", nom: "Foyer F", logementId: "L05", entree: "2026-01-01" }],
    releves: e.releves.map((r) => (r.logementId === "L05" ? { ...r, fin: { ...r.fin, index: 615 } } : r)),
    cycle: { ...e.cycle, indexPrincipalFin: 30400 + 294 + 16 },
  };
  const r = repartirCycle(entree);
  const f = r.participants.find((p) => p.occupantId === "F")!;

  it("paie sa part de l'écart et des frais fixes, avec une TVA jamais négative", () => {
    expect(r.ok).toBe(true);
    expect(f.kwhMesures).toBe(0);
    expect(f.kwhCorriges).toBeCloseTo(16 / 5, 10);
    expect(f.tva).toBeGreaterThanOrEqual(0);
    expect(f.franchiseTva).toBeLessThanOrEqual(f.assietteTva + 1e-9);
  });

  it("la somme des TVA reste celle de la facture", () => {
    expect(r.totaux?.tva).toBeCloseTo(r.facture!.tva, 2);
    expect(r.totaux?.franchiseTva).toBeCloseTo(34000, 8);
  });
});

describe("repartirCycle — erreurs de saisie", () => {
  it("dates de cycle invalides", () => {
    const e = exempleSpecification();
    const r = repartirCycle({ ...e, cycle: { ...e.cycle, fin: "2026-08-20" } });
    expect(r.ok).toBe(false);
    expect(codes(r)).toEqual(["erreur:CYCLE_DATES_INVALIDES"]);
  });

  it("index principal en baisse", () => {
    const e = exempleSpecification();
    expect(codes(repartirCycle({ ...e, cycle: { ...e.cycle, indexPrincipalFin: 30000 } }))).toContain(
      "erreur:INDEX_PRINCIPAL_EN_BAISSE",
    );
  });

  it("aucun participant", () => {
    expect(codes(repartirCycle({ ...exempleSpecification(), occupations: [] }))).toContain("erreur:AUCUN_PARTICIPANT");
  });

  it("grille invalide", () => {
    const e = exempleSpecification();
    const r = repartirCycle({ ...e, grille: { ...e.grille, tranches: [{ plafondKwh: 130, prixKwh: 340 }] } });
    expect(codes(r)).toContain("erreur:GRILLE_INVALIDE");
  });
});

describe("repartirFranchise", () => {
  it("répartit selon les poids quand aucun plafond n'est atteint", () => {
    const f = repartirFranchise(dec(300), [dec(1000), dec(1000), dec(1000)], [dec(1), dec(1), dec(1)]);
    expect(f.map((x) => x.toNumber())).toEqual([100, 100, 100]);
  });

  it("redistribue aux autres ce qu'un participant ne peut pas absorber", () => {
    const f = repartirFranchise(dec(300), [dec(40), dec(1000), dec(1000)], [dec(1), dec(1), dec(2)]);
    expect(f.map((x) => x.toNumber())).toEqual([40, 260 / 3, 520 / 3]);
  });
});
