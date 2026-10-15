import { dec, max, min, somme, ZERO, type Dec } from "./decimal";
import type { Diagnostic, GrilleTarifaire } from "./types";

/**
 * Grille reconstituée à partir des factures d'avril, mai et juin 2022 (tarif 20 « Économique »).
 * Valeurs par défaut : l'admin les vérifie avec les prix imprimés sur chaque facture.
 */
export function grilleTarif20Economique2022(puissanceSouscriteKw: number): GrilleTarifaire {
  return {
    nom: "Tarif 20 Économique (2022)",
    tranches: [
      { plafondKwh: 130, prixKwh: 340 },
      { plafondKwh: 300, prixKwh: 560 },
      { plafondKwh: null, prixKwh: 764 },
    ],
    coefficientTranche: 1,
    fraisFixes: [
      { libelle: "Redevance JIRAMA", prixUnitaire: 8000 },
      { libelle: "Prime fixe", prixUnitaire: 3018, quantite: puissanceSouscriteKw },
    ],
    taxes: [
      { libelle: "Taxe communale", assiette: "energie", taux: 0.035 },
      { libelle: "Surtaxe communale", assiette: "energie", taux: 0.005 },
      { libelle: "Fonds national de l'énergie durable", assiette: "energie", taux: 0.0125 },
    ],
    tva: { taux: 0.2, franchiseKwh: 100 },
  };
}

export function validerGrille(grille: GrilleTarifaire): Diagnostic[] {
  const diags: Diagnostic[] = [];
  const erreur = (message: string) => diags.push({ code: "GRILLE_INVALIDE", niveau: "erreur", message });
  const { tranches } = grille;

  if (tranches.length === 0) {
    erreur("La grille ne contient aucune tranche.");
    return diags;
  }
  if (tranches[tranches.length - 1].plafondKwh !== null) {
    erreur("La dernière tranche ne doit pas avoir de plafond.");
  }
  let precedent = 0;
  tranches.slice(0, -1).forEach((t, i) => {
    if (t.plafondKwh === null || !(t.plafondKwh > precedent)) {
      erreur(`Le plafond de la tranche ${i + 1} doit être supérieur à celui de la tranche précédente.`);
    } else {
      precedent = t.plafondKwh;
    }
  });
  if (tranches.some((t) => !(t.prixKwh >= 0))) erreur("Un prix de tranche est négatif ou manquant.");
  if (!(grille.coefficientTranche > 0)) erreur("Le coefficient de tranche doit être positif.");
  if (!(grille.tva.taux >= 0) || !(grille.tva.franchiseKwh >= 0)) erreur("Les paramètres de TVA sont invalides.");

  if (tranches.some((t, i) => i > 0 && t.prixKwh < tranches[i - 1].prixKwh)) {
    diags.push({
      code: "PRIX_NON_CROISSANTS",
      niveau: "avertissement",
      message: "Les prix ne sont pas croissants d'une tranche à l'autre : vérifiez la grille.",
    });
  }
  return diags;
}

/** Tranche avec ses bornes en kWh, coefficient appliqué. `fin` vaut `null` pour la dernière. */
export interface TrancheBornee {
  debut: Dec;
  fin: Dec | null;
  prix: Dec;
}

export function bornesTranches(grille: GrilleTarifaire): TrancheBornee[] {
  const coef = dec(grille.coefficientTranche);
  let debut = ZERO;
  return grille.tranches.map((t) => {
    const fin = t.plafondKwh === null ? null : dec(t.plafondKwh).times(coef);
    const tranche = { debut, fin, prix: dec(t.prixKwh) };
    if (fin) debut = fin;
    return tranche;
  });
}

/** kWh de l'intervalle [a, b] (en kWh cumulés du bâtiment) qui tombent dans chaque tranche. */
export function kwhParTrancheEntre(a: Dec, b: Dec, tranches: TrancheBornee[]): Dec[] {
  return tranches.map((t) => {
    const bas = max(a, t.debut);
    const haut = t.fin === null ? b : min(b, t.fin);
    return haut.greaterThan(bas) ? haut.minus(bas) : ZERO;
  });
}

/** Coût hors taxes de `kwh` kWh, sans arrondi. */
export function coutEnergie(kwh: Dec, tranches: TrancheBornee[]): Dec {
  return somme(kwhParTrancheEntre(ZERO, kwh, tranches).map((q, i) => q.times(tranches[i].prix)));
}
