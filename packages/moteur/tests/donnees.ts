import { grilleTarif20Economique2022, type EntreeCycle } from "../src";

/** Exemple §6 de la spécification : 5 participants, un déménagement avec relevé, un logement vide. */
export function exempleSpecification(): EntreeCycle {
  return {
    cycle: {
      debut: "2026-08-26",
      fin: "2026-09-25",
      indexPrincipalDebut: 30400,
      indexPrincipalFin: 30710,
      totalFactureSaisi: 200462.8,
    },
    grille: grilleTarif20Economique2022(3.3),
    occupations: [
      { occupantId: "A", nom: "Foyer A", logementId: "L01", entree: "2026-01-12" },
      { occupantId: "B", nom: "Foyer B", logementId: "L02", entree: "2025-03-03" },
      { occupantId: "C", nom: "Foyer C", logementId: "L03", entree: "2024-06-01" },
      { occupantId: "D", nom: "Foyer D", logementId: "L04", entree: "2025-02-15", sortie: "2026-09-07" },
      { occupantId: "E", nom: "Foyer E", logementId: "L04", entree: "2026-09-07" },
    ],
    releves: [
      { logementId: "L01", debut: { date: "2026-08-26", index: 1200 }, fin: { date: "2026-09-25", index: 1220 } },
      { logementId: "L02", debut: { date: "2026-08-26", index: 4510 }, fin: { date: "2026-09-25", index: 4570 } },
      { logementId: "L03", debut: { date: "2026-08-26", index: 8840 }, fin: { date: "2026-09-25", index: 9000 } },
      {
        logementId: "L04",
        debut: { date: "2026-08-26", index: 2300 },
        fin: { date: "2026-09-25", index: 2354 },
        intermediaires: [{ date: "2026-09-07", index: 2318 }],
      },
      { logementId: "L05", debut: { date: "2026-08-26", index: 615 }, fin: { date: "2026-09-25", index: 617 } },
    ],
    parametres: { pasArrondi: 0.01 },
  };
}
