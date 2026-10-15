import type { BrouillonCycle } from "../domaine/brouillon";

/**
 * Accès aux données. Seule cette couche changera lors du passage à Firebase
 * (spécification §11) : les écrans ne connaissent que cette interface.
 */
export interface DepotBrouillon {
  charger(): BrouillonCycle | null;
  enregistrer(brouillon: BrouillonCycle): void;
}

const CLE = "partage-jirama:brouillon-cycle";

/** Dépôt provisoire : le brouillon est gardé dans le navigateur de l'admin. */
export const depotLocal: DepotBrouillon = {
  charger() {
    try {
      const brut = localStorage.getItem(CLE);
      if (!brut) return null;
      const brouillon = JSON.parse(brut) as BrouillonCycle;
      return brouillon.version === 1 ? brouillon : null;
    } catch {
      return null;
    }
  },
  enregistrer(brouillon) {
    try {
      localStorage.setItem(CLE, JSON.stringify(brouillon));
    } catch {
      // Stockage indisponible (navigation privée…) : la saisie reste en mémoire.
    }
  },
};
