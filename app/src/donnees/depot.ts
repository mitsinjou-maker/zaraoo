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
  /** Identifiant du cycle validé le plus récent (seul celui-là peut être annulé). */
  dernierCycleId(): Promise<string | undefined>;
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

const cles = (prefixe: string) => ({
  brouillon: `${prefixe}:brouillon-cycle`,
  cycles: `${prefixe}:cycles`,
  reglages: `${prefixe}:reglages`,
});

/** Dépôt sans compte : tout reste dans ce navigateur, sous des clés commençant par `prefixe`. */
export function creerDepotLocal(prefixe: string): Depot {
  const cle = cles(prefixe);
  const cycles = () => lire<CycleValide[]>(cle.cycles) ?? [];
  const lister = async () => cycles().map(resumer).sort((a, b) => b.dateFin.localeCompare(a.dateFin));
  return {
    lieu: "navigateur",
    async chargerBrouillon() {
      const b = lire<BrouillonCycle>(cle.brouillon);
      return b?.version === 1 ? b : null;
    },
    async enregistrerBrouillon(brouillon) {
      ecrire(cle.brouillon, brouillon);
    },
    listerCycles: lister,
    async dernierCycleId() {
      return (await lister())[0]?.id;
    },
    async chargerCycle(id) {
      return cycles().find((c) => c.id === id) ?? null;
    },
    async chargerTousLesCycles() {
      return cycles();
    },
    async validerCycle(cycle, suivant) {
      ecrire(cle.cycles, [...cycles(), cycle]);
      ecrire(cle.brouillon, suivant);
    },
    async annulerValidation(cycle) {
      ecrire(
        cle.cycles,
        cycles().filter((c) => c.id !== cycle.id),
      );
      ecrire(cle.brouillon, cycle.brouillon);
    },
    async chargerReglages() {
      const r = lire<Reglages>(cle.reglages);
      return r?.version === 1 ? r : null;
    },
    async enregistrerReglages(reglages) {
      ecrire(cle.reglages, reglages);
    },
  };
}

/** Supprime de ce navigateur toutes les données d'un dépôt local. */
export function effacerDepotLocal(prefixe: string): void {
  try {
    for (const c of Object.values(cles(prefixe))) localStorage.removeItem(c);
  } catch {
    // Stockage indisponible : rien n'a été enregistré.
  }
}

/** Mode local du développement (sans configuration Firebase). */
export const depotLocal = creerDepotLocal("partage-jirama");

/** Mode essai, sans compte, sur le site en ligne : séparé des autres données du navigateur. */
export const PREFIXE_ESSAI = "zaraoo-essai";
export const depotEssai = creerDepotLocal(PREFIXE_ESSAI);