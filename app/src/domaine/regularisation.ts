import type { ResultatCycle } from "@partage-jirama/moteur";
import type { BrouillonCycle, Regularisation } from "./brouillon";

export interface NetFoyer {
  /** Ce que le foyer a déjà payé pour le cycle estimé. */
  credit: number;
  /** Part de la facture de régularisation moins ce crédit : ce qui reste à payer (négatif = à rembourser). */
  net: number;
}

export interface BilanRegularisation {
  regularisation: Regularisation;
  parFoyer: Map<string, NetFoyer>;
  /** Foyers crédités qui ne participent pas au cycle de régularisation : à rembourser à part. */
  creditsSansParticipant: Regularisation["credits"];
  sommeCredits: number;
  sommeNets: number;
  /** Ligne (4) saisie, ou le total estimé si elle est vide. */
  deduction: number;
  /** Ligne (4) − somme des crédits : non nul si la JIRAMA a déduit un autre montant que celui réparti. */
  differenceDeduction: number;
}

const centimes = (n: number) => Math.round(n * 100) / 100;

/**
 * Bilan d'un cycle de régularisation (spécification §8) : chaque foyer paie sa part de la facture
 * réelle, qui couvre aussi la période estimée, moins ce qu'il a déjà payé pour le cycle estimé.
 * `null` si le cycle ne régularise rien.
 */
export function bilanRegularisation(b: BrouillonCycle, resultat: ResultatCycle | null): BilanRegularisation | null {
  const regularisation = b.facture.regularisation;
  if (!regularisation || !resultat) return null;

  const creditParFoyer = new Map<string, number>();
  for (const c of regularisation.credits) creditParFoyer.set(c.occupantId, (creditParFoyer.get(c.occupantId) ?? 0) + c.montant);

  const parFoyer = new Map<string, NetFoyer>();
  for (const p of resultat.participants) {
    const credit = creditParFoyer.get(p.occupantId) ?? 0;
    parFoyer.set(p.occupantId, { credit, net: centimes(p.totalArrondi - credit) });
  }
  const participants = new Set(resultat.participants.map((p) => p.occupantId));
  const creditsSansParticipant = regularisation.credits.filter((c) => !participants.has(c.occupantId));
  const sommeCredits = centimes(regularisation.credits.reduce((s, c) => s + c.montant, 0));
  const sommeNets = centimes([...parFoyer.values()].reduce((s, x) => s + x.net, 0));
  const deduction = b.facture.deductionEstimee ?? regularisation.totalEstime;

  return {
    regularisation,
    parFoyer,
    creditsSansParticipant,
    sommeCredits,
    sommeNets,
    deduction,
    differenceDeduction: centimes(deduction - sommeCredits),
  };
}
