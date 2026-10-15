import { describe, expect, it } from "vitest";
import { analyserBrouillon } from "./brouillon";
import { brouillonSuivant, figerCycle } from "./cycles";
import { brouillonExemple } from "./exemple";
import { bilanRegularisation } from "./regularisation";

describe("facture estimée puis régularisation", () => {
  // Cycle de septembre validé sur une facture estimée.
  const sept = brouillonExemple();
  sept.facture.estimee = true;
  const cycleEstime = figerCycle(sept, analyserBrouillon(sept).resultat!, new Date("2026-10-01T08:00:00Z"));
  const regul = brouillonSuivant(sept, cycleEstime);

  it("le cycle suivant repart du début du cycle estimé et prépare les crédits", () => {
    expect(regul.facture).toMatchObject({ dateDebut: "2026-08-26", indexDebut: 30400, deductionEstimee: 200462.8 });
    expect(regul.facture.regularisation!.mois).toBe("Septembre 2026");
    expect(regul.facture.regularisation!.credits.map((c) => [c.nom, c.montant])).toEqual([
      ["Foyer A", 13994],
      ["Foyer B", 39136],
      ["Foyer C", 112440],
      ["Foyer D", 11411],
      ["Foyer E", 23482],
    ]);
    // Relevés repris du cycle estimé : index de début et relevé de déménagement.
    expect(regul.releves.L04).toMatchObject({ indexDebut: 2300, intermediaires: { "2026-09-07": 2318 } });
    // D, parti pendant le cycle estimé, reste dans la régularisation (il a des jours sur la période).
    expect(regul.occupations.map((o) => o.occupantId)).toEqual(["A", "B", "C", "D", "E"]);
  });

  it("chaque foyer paie sa part de la facture réelle moins ce qu'il a déjà payé", () => {
    // Facture réelle d'octobre : 26/08 → 25/10, deux mois, 610 kWh, coefficient de tranche 2.
    const b = structuredClone(regul);
    Object.assign(b.facture, { mois: "Octobre 2026", dateFin: "2026-10-25", indexFin: 31010, coefficientTranche: 2 });
    const index: Record<string, number> = { L01: 1240, L02: 4630, L03: 9160, L04: 2410, L05: 619 };
    for (const [id, v] of Object.entries(index)) b.releves[id].indexFin = v;
    const sansTotal = analyserBrouillon(b);
    b.facture.totalSaisi = sansTotal.facture!.total;
    const resultat = analyserBrouillon(b).resultat!;
    expect(resultat.ok).toBe(true);

    const bilan = bilanRegularisation(b, resultat)!;
    expect(bilan.sommeCredits).toBe(200463);
    expect(bilan.creditsSansParticipant).toEqual([]);
    for (const p of resultat.participants) {
      const credit = cycleEstime.resultat.participants.find((x) => x.occupantId === p.occupantId)!.totalArrondi;
      expect(bilan.parFoyer.get(p.occupantId)).toEqual({ credit, net: Math.round((p.totalArrondi - credit) * 100) / 100 });
    }
    // Total net = facture réelle − déjà payé.
    expect(bilan.sommeNets).toBeCloseTo(resultat.totaux!.totalArrondi - 200463, 2);
    expect(bilan.differenceDeduction).toBeCloseTo(-0.2, 2); // la JIRAMA déduit 200 462,80, les foyers ont payé 200 463
  });

  it("un cycle normal n'a pas de régularisation", () => {
    const normal = brouillonSuivant(brouillonExemple(), figerCycle(brouillonExemple(), analyserBrouillon(brouillonExemple()).resultat!));
    expect(normal.facture.regularisation).toBeNull();
    expect(normal.facture.dateDebut).toBe("2026-09-25");
  });
});
