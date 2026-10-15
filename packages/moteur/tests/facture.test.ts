import { describe, expect, it } from "vitest";
import { calculerFacture, grilleTarif20Economique2022 } from "../src";

const grille = grilleTarif20Economique2022(3.3);

describe("calculerFacture — factures JIRAMA réelles de 2022", () => {
  it("avril 2022 : 451 kWh → 336 518,21 Ar", () => {
    const f = calculerFacture(451, grille);
    expect(f.tranches.map((t) => t.kwh)).toEqual([130, 170, 151]);
    expect(f.tranches.map((t) => t.montant)).toEqual([44200, 95200, 115364]);
    expect(f.fraisFixes.map((l) => l.montant)).toEqual([8000, 9959.4]);
    expect(f.sousTotalJirama).toBe(272723.4);
    expect(f.taxes.map((t) => t.montant)).toEqual([8916.74, 1273.82, 3184.55]);
    expect(f.sousTotalTaxes).toBe(13375.11);
    expect(f.franchiseTva).toBe(34000);
    expect(f.tva).toBe(50419.7);
    expect(f.total).toBe(336518.21);
  });

  it("mai 2022 : 425 kWh → 311 429,98 Ar", () => {
    expect(calculerFacture(425, grille).total).toBe(311429.98);
  });

  it("juin 2022 : 526 kWh → 408 888,11 Ar", () => {
    const f = calculerFacture(526, grille);
    expect(f.tranches.map((t) => t.montant)).toEqual([44200, 95200, 172664]);
    expect(f.sousTotalJirama).toBe(330023.4);
    expect(f.taxes.map((t) => t.montant)).toEqual([10922.24, 1560.32, 3900.8]);
    expect(f.tva).toBe(62481.35);
    expect(f.total).toBe(408888.11);
  });
});

describe("calculerFacture — paramètres", () => {
  it("le coefficient de tranche multiplie les plafonds", () => {
    const f = calculerFacture(451, { ...grille, coefficientTranche: 2 });
    expect(f.tranches.map((t) => t.kwh)).toEqual([260, 191, 0]);
  });

  it("la franchise de TVA est plafonnée à la consommation sous 100 kWh", () => {
    expect(calculerFacture(50, grille).franchiseTva).toBe(17000);
  });

  it("une consommation nulle ne coûte que les frais fixes, taxés à la TVA", () => {
    const f = calculerFacture(0, grille);
    expect(f.energie).toBe(0);
    expect(f.sousTotalTaxes).toBe(0);
    expect(f.tva).toBe(3591.88);
    expect(f.total).toBe(21551.28);
  });

  it("une taxe à montant fixe s'ajoute au bloc (2)", () => {
    const f = calculerFacture(451, {
      ...grille,
      taxes: [...grille.taxes, { libelle: "Redevance assainissement", assiette: "fixe", montant: 500 }],
    });
    expect(f.sousTotalTaxes).toBe(13875.11);
  });
});
