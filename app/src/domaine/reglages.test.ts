import { describe, expect, it } from "vitest";
import { analyserBrouillon, tarifParDefaut } from "./brouillon";
import { brouillonExemple } from "./exemple";
import {
  grilleEnVigueur,
  memeTarif,
  nouvelleGrille,
  PARAMETRES_SAISIS_PAR_DEFAUT,
  reglagesParDefaut,
  tarifDeGrille,
  verifierParametres,
  verifierTarif,
} from "./reglages";

describe("grilles tarifaires datées", () => {
  const r = reglagesParDefaut();
  const g2027 = { ...nouvelleGrille(r.grilles[0], "2027-01-01"), nom: "Tarif 2027" };
  g2027.tarif.tranches[0].prixKwh = 380;
  r.grilles.push(g2027);

  it("choisit la grille en vigueur à la date de la facture", () => {
    expect(grilleEnVigueur(r, "2026-09-25")?.nom).toBe("Tarif 20 Économique");
    expect(grilleEnVigueur(r, "2027-01-01")?.nom).toBe("Tarif 2027");
    expect(grilleEnVigueur(r, "2020-01-01")?.nom).toBe("Tarif 20 Économique"); // aucune avant : la plus ancienne
    expect(grilleEnVigueur(r, null)?.nom).toBe("Tarif 2027");
  });

  it("compare les tarifs sans tenir compte du nom", () => {
    expect(memeTarif(tarifDeGrille(r.grilles[0]), tarifParDefaut())).toBe(true);
    expect(memeTarif(g2027.tarif, tarifParDefaut())).toBe(false);
  });

  it("une 4e tranche et un nouveau frais sont pris en compte par le calcul", () => {
    const b = brouillonExemple();
    b.tarif.tranches = [
      { plafondKwh: 130, prixKwh: 340 },
      { plafondKwh: 300, prixKwh: 560 },
      { plafondKwh: 305, prixKwh: 764 },
      { plafondKwh: null, prixKwh: 900 },
    ];
    b.tarif.fraisFixes.push({ libelle: "Location compteur", prixUnitaire: 1000, parKw: false });
    const a = analyserBrouillon(b);
    expect(a.facture!.tranches.map((t) => t.kwh)).toEqual([130, 170, 5, 5]);
    expect(a.facture!.fraisFixes.map((f) => f.montant)).toEqual([8000, 9959.4, 1000]);
  });
});

describe("vérifications", () => {
  it("détecte les plafonds non croissants et les valeurs manquantes", () => {
    const t = tarifParDefaut();
    expect(verifierTarif(t)).toEqual([]);
    t.tranches[1].plafondKwh = 100;
    t.taxes[0].tauxPourcent = null;
    expect(verifierTarif(t)).toEqual(["Tranche 2 : le plafond doit dépasser 130 kWh.", "Taxe communale : taux manquant."]);
  });

  it("contrôle les règles de répartition", () => {
    expect(verifierParametres(PARAMETRES_SAISIS_PAR_DEFAUT)).toBeNull();
    expect(verifierParametres({ ...PARAMETRES_SAISIS_PAR_DEFAUT, pasArrondiAr: 0 })).toBe("Pas d'arrondi : montant positif.");
    expect(verifierParametres({ ...PARAMETRES_SAISIS_PAR_DEFAUT, toleranceJoursReleve: 1.5 })).not.toBeNull();
    // Champ vidé pendant la saisie.
    expect(verifierParametres({ ...PARAMETRES_SAISIS_PAR_DEFAUT, toleranceFactureAr: null as unknown as number })).toBe(
      "Toutes les règles de répartition doivent être remplies.",
    );
  });
});

describe("règles de répartition appliquées au calcul", () => {
  it("le pas d'arrondi et le seuil d'écart viennent des réglages", () => {
    const b = brouillonExemple();
    const auCentime = analyserBrouillon(b, { ...PARAMETRES_SAISIS_PAR_DEFAUT, pasArrondiAr: 0.01 }).resultat!;
    expect(auCentime.participants[0].totalArrondi).toBe(13993.9);
    const strict = analyserBrouillon(b, { ...PARAMETRES_SAISIS_PAR_DEFAUT, seuilEcartPositifPourcent: 5 }).resultat!;
    expect(strict.ok).toBe(false); // écart de 5,16 % > 5 %
    expect(strict.diagnostics.some((d) => d.code === "ECART_ELEVE")).toBe(true);
  });
});
