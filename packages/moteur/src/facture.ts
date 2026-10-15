import { centimes, dec, max, min, somme, ZERO, type Dec } from "./decimal";
import { bornesTranches, kwhParTrancheEntre } from "./tarif";
import type { FactureCalculee, GrilleTarifaire } from "./types";

/** Facture en précision décimale, pour l'usage interne du moteur. */
export interface FactureInterne {
  kwh: Dec;
  tranches: { kwh: Dec; prix: Dec; montant: Dec }[];
  energie: Dec;
  fraisFixes: { libelle: string; montant: Dec }[];
  totalFraisFixes: Dec;
  sousTotalJirama: Dec;
  taxes: { libelle: string; assiette: "energie" | "fixe"; montant: Dec }[];
  totalTaxes: Dec;
  franchiseTva: Dec;
  baseTva: Dec;
  tva: Dec;
  total: Dec;
}

/**
 * Recalcule une facture JIRAMA (spécification §2). Chaque ligne est arrondie au centime,
 * comme sur la facture papier.
 */
export function calculerFactureInterne(kwh: Dec, grille: GrilleTarifaire): FactureInterne {
  const bornes = bornesTranches(grille);
  const tranches = kwhParTrancheEntre(ZERO, kwh, bornes).map((q, i) => ({
    kwh: q,
    prix: bornes[i].prix,
    montant: centimes(q.times(bornes[i].prix)),
  }));
  const energie = somme(tranches.map((t) => t.montant));

  const fraisFixes = grille.fraisFixes.map((f) => ({
    libelle: f.libelle,
    montant: centimes(dec(f.prixUnitaire).times(f.quantite ?? 1)),
  }));
  const totalFraisFixes = somme(fraisFixes.map((f) => f.montant));
  const sousTotalJirama = energie.plus(totalFraisFixes);

  const taxes = grille.taxes.map((t) => ({
    libelle: t.libelle,
    assiette: t.assiette,
    montant: t.assiette === "energie" ? centimes(energie.times(t.taux)) : centimes(dec(t.montant)),
  }));
  const totalTaxes = somme(taxes.map((t) => t.montant));

  const kwhExoneres = min(max(kwh, ZERO), dec(grille.tva.franchiseKwh));
  const franchiseTva = centimes(kwhExoneres.times(bornes[0].prix));
  const baseTva = sousTotalJirama.plus(totalTaxes).minus(franchiseTva);
  const tva = centimes(max(baseTva, ZERO).times(grille.tva.taux));

  return {
    kwh,
    tranches,
    energie,
    fraisFixes,
    totalFraisFixes,
    sousTotalJirama,
    taxes,
    totalTaxes,
    franchiseTva,
    baseTva,
    tva,
    total: sousTotalJirama.plus(totalTaxes).plus(tva),
  };
}

export function versFactureCalculee(f: FactureInterne): FactureCalculee {
  return {
    kwh: f.kwh.toNumber(),
    tranches: f.tranches.map((t) => ({ kwh: t.kwh.toNumber(), prixKwh: t.prix.toNumber(), montant: t.montant.toNumber() })),
    energie: f.energie.toNumber(),
    fraisFixes: f.fraisFixes.map((l) => ({ libelle: l.libelle, montant: l.montant.toNumber() })),
    sousTotalJirama: f.sousTotalJirama.toNumber(),
    taxes: f.taxes.map((l) => ({ libelle: l.libelle, montant: l.montant.toNumber() })),
    sousTotalTaxes: f.totalTaxes.toNumber(),
    franchiseTva: f.franchiseTva.toNumber(),
    baseTva: f.baseTva.toNumber(),
    tva: f.tva.toNumber(),
    total: f.total.toNumber(),
  };
}

/** Recalcule la facture du compteur principal pour `kwh` kWh. */
export function calculerFacture(kwh: number, grille: GrilleTarifaire): FactureCalculee {
  return versFactureCalculee(calculerFactureInterne(dec(kwh), grille));
}
