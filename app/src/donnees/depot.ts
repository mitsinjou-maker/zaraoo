import type { BrouillonCycle } from "../domaine/brouillon";
import { resumer, type CycleValide, type ResumeCycle } from "../domaine/cycles";
import type { Reglages } from "../domaine/reglages";

/**
 * Accès aux données. Les écrans ne connaissent que cette interface : elle est implémentée
 * par Firebase (`depotFirebase`) et, sans configuration Firebase, par le navigateur (`depotLocal`).
 */
export interface Depot {
  /** Où sont rangées les données, pour l'afficher à l'admin. */
  lieu: "navigateur" | "firebase";
  chargerBrouillon(): Promise<BrouillonCycle | null>;
  enregistrerBrouillon(brouillon: BrouillonCycle): Promise<void>;
  /** Signale les modifications du brouillon faites ailleurs (autre appareil). Renvoie la fonction d'arrêt. */
  ecouterBrouillon?(rappel: (brouillon: BrouillonCycle) => void): () => void;
  /** Cycles validés, du plus récent au plus ancien. */
  listerCycles(): Promise<ResumeCycle[]>;
  chargerCycle(id: string): Promise<CycleValide | null>;
  /** Tous les cycles validés, complets (pour l'export). */
  chargerTousLesCycles(): Promise<CycleValide[]>;
  /** Enregistre le cycle validé (figé) et le brouillon du cycle suivant, ensemble. */
  validerCycle(cycle: CycleValide, suivant: BrouillonCycle): Promise<void>;
  /** Annule la validation : supprime le cycle et en refait le brouillon en cours, ensemble. */
  annulerValidation(cycle: CycleValide): Promise<void>;
  /** Grilles tarifaires et règles de répartition (`null` si jamais enregistrées). */
  chargerReglages(): Promise<Reglages | null>;
  enregistrerReglages(reglages: Reglages): Promise<void>;
}

const CLE_BROUILLON = "partage-jirama:brouillon-cycle";
const CLE_CYCLES = "partage-jirama:cycles";
const CLE_REGLAGES = "partage-jirama:reglages";

function lire<T>(cle: string): T | null {
  try {
    const brut = localStorage.getItem(cle);
    return brut ? (JSON.parse(brut) as T) : null;
  } catch {
    return null;
  }
}

function ecrire(cle: string, valeur: unknown) {
  try {
    localStorage.setItem(cle, JSON.stringify(valeur));
  } catch {
    // Stockage indisponible (navigation privée…) : la saisie reste en mémoire.
  }
}

/** Dépôt sans compte : tout reste dans ce navigateur. */
export const depotLocal: Depot = {
  lieu: "navigateur",
  async chargerBrouillon() {
    const b = lire<BrouillonCycle>(CLE_BROUILLON);
    return b?.version === 1 ? b : null;
  },
  async enregistrerBrouillon(brouillon) {
    ecrire(CLE_BROUILLON, brouillon);
  },
  async listerCycles() {
    return (lire<CycleValide[]>(CLE_CYCLES) ?? []).map(resumer).sort((a, b) => b.dateFin.localeCompare(a.dateFin));
  },
  async chargerCycle(id) {
    return (lire<CycleValide[]>(CLE_CYCLES) ?? []).find((c) => c.id === id) ?? null;
  },
  async chargerTousLesCycles() {
    return lire<CycleValide[]>(CLE_CYCLES) ?? [];
  },
  async validerCycle(cycle, suivant) {
    ecrire(CLE_CYCLES, [...(lire<CycleValide[]>(CLE_CYCLES) ?? []), cycle]);
    ecrire(CLE_BROUILLON, suivant);
  },
  async annulerValidation(cycle) {
    ecrire(
      CLE_CYCLES,
      (lire<CycleValide[]>(CLE_CYCLES) ?? []).filter((c) => c.id !== cycle.id),
    );
    ecrire(CLE_BROUILLON, cycle.brouillon);
  },
  async chargerReglages() {
    const r = lire<Reglages>(CLE_REGLAGES);
    return r?.version === 1 ? r : null;
  },
  async enregistrerReglages(reglages) {
    ecrire(CLE_REGLAGES, reglages);
  },
};
