import { COULEURS_LOGEMENTS, tarifParDefaut, type BrouillonCycle } from "./brouillon";

/**
 * Données fictives de l'exemple §6 de la spécification : elles permettent de découvrir l'écran
 * avant de saisir un vrai cycle.
 */
export function brouillonExemple(): BrouillonCycle {
  const logements = ["L01", "L02", "L03", "L04", "L05"].map((id, i) => ({ id, couleur: COULEURS_LOGEMENTS[i] }));
  return {
    version: 1,
    exemple: true,
    facture: {
      numero: "FAC-EXEMPLE-0001",
      mois: "Septembre 2026",
      dateDebut: "2026-08-26",
      dateFin: "2026-09-25",
      indexDebut: 30400,
      indexFin: 30710,
      coefficientTranche: 1,
      puissanceKw: 3.3,
      estimee: false,
      totalSaisi: 200462.8,
    },
    tarif: tarifParDefaut(),
    logements,
    occupations: [
      { id: "o-a", occupantId: "A", nom: "Foyer A", logementId: "L01", entree: "2026-01-12", sortie: null },
      { id: "o-b", occupantId: "B", nom: "Foyer B", logementId: "L02", entree: "2025-03-03", sortie: null },
      { id: "o-c", occupantId: "C", nom: "Foyer C", logementId: "L03", entree: "2024-06-01", sortie: null },
      { id: "o-d", occupantId: "D", nom: "Foyer D", logementId: "L04", entree: "2025-02-15", sortie: "2026-09-07" },
      { id: "o-e", occupantId: "E", nom: "Foyer E", logementId: "L04", entree: "2026-09-07", sortie: null },
    ],
    releves: {
      L01: { indexDebut: 1200, dateFin: null, indexFin: 1220, intermediaires: {} },
      L02: { indexDebut: 4510, dateFin: null, indexFin: 4570, intermediaires: {} },
      L03: { indexDebut: 8840, dateFin: "2026-09-26", indexFin: 9000, intermediaires: {} },
      L04: { indexDebut: 2300, dateFin: null, indexFin: 2354, intermediaires: { "2026-09-07": 2318 } },
      L05: { indexDebut: 615, dateFin: null, indexFin: 617, intermediaires: {} },
    },
    parametres: { forcerFacture: false, forcerEcart: false },
  };
}
