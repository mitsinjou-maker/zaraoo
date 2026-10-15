import { somme, ZERO, type Dec } from "./decimal";
import { kwhParTrancheEntre, type TrancheBornee } from "./tarif";

export interface Demande {
  /** Consommation corrigée (écart compris), en kWh. */
  kwh: Dec;
  /** Poids de présence, strictement positif. */
  poids: Dec;
}

export interface PartEnergie {
  kwhParTranche: Dec[];
  montant: Dec;
}

/**
 * Partage sériel pondéré de l'énergie (spécification §5.5).
 *
 * Tous les participants « montent » ensemble dans les tranches, chacun au rythme de son poids.
 * Celui qui atteint sa consommation s'arrête ; les kWh de chaque palier sont partagés entre
 * ceux qui montent encore, au prorata de leur poids. Ce que paie un participant ne dépend donc
 * jamais de ceux qui consomment plus que lui par jour de présence.
 *
 * Retourne les parts dans l'ordre des demandes. La somme des montants est égale au coût
 * de la somme des kWh.
 */
export function partageSeriel(demandes: Demande[], tranches: TrancheBornee[]): PartEnergie[] {
  const parts: PartEnergie[] = demandes.map(() => ({ kwhParTranche: tranches.map(() => ZERO), montant: ZERO }));
  const ordre = demandes
    .map((d, i) => ({ i, niveau: d.kwh.dividedBy(d.poids) }))
    .sort((a, b) => a.niveau.comparedTo(b.niveau));

  let kwhBatiment = ZERO;
  let niveau = ZERO;
  for (let j = 0; j < ordre.length; j++) {
    const actifs = ordre.slice(j).map((o) => o.i);
    const poidsActifs = somme(actifs.map((i) => demandes[i].poids));
    const prochainNiveau = ordre[j].niveau;
    const palier = poidsActifs.times(prochainNiveau.minus(niveau));
    if (palier.greaterThan(0)) {
      const kwhPalier = kwhParTrancheEntre(kwhBatiment, kwhBatiment.plus(palier), tranches);
      for (const i of actifs) {
        const fraction = demandes[i].poids.dividedBy(poidsActifs);
        const part = parts[i];
        kwhPalier.forEach((q, t) => {
          const kwh = q.times(fraction);
          part.kwhParTranche[t] = part.kwhParTranche[t].plus(kwh);
          part.montant = part.montant.plus(kwh.times(tranches[t].prix));
        });
      }
      kwhBatiment = kwhBatiment.plus(palier);
    }
    niveau = prochainNiveau;
  }
  return parts;
}
