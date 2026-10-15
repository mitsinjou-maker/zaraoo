import Decimal from "decimal.js";
import { somme, type Dec } from "./decimal";

/**
 * Arrondit chaque montant au `pas` par la méthode du plus fort reste, de façon que la somme
 * des montants arrondis soit égale à `cible` arrondie au même pas (spécification §5.9).
 */
export function arrondirPlusFortReste(montants: Dec[], cible: Dec, pas: Dec): { arrondis: Dec[]; cibleArrondie: Dec } {
  const cibleArrondie = cible.dividedBy(pas).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).times(pas);
  const planchers = montants.map((m) => m.dividedBy(pas).floor());
  const restes = montants.map((m, i) => m.dividedBy(pas).minus(planchers[i]));
  let unites = cibleArrondie.dividedBy(pas).minus(somme(planchers)).toNumber();

  // Priorité : plus fort reste, puis plus gros montant, puis ordre d'origine.
  const ordre = montants
    .map((_, i) => i)
    .sort((a, b) => restes[b].comparedTo(restes[a]) || montants[b].comparedTo(montants[a]) || a - b);

  const unitesParMontant = [...planchers];
  for (let k = 0; unites > 0 && ordre.length > 0; k = (k + 1) % ordre.length, unites--) {
    unitesParMontant[ordre[k]] = unitesParMontant[ordre[k]].plus(1);
  }
  for (let k = 0; unites < 0 && ordre.length > 0; k = (k + 1) % ordre.length, unites++) {
    const i = ordre[ordre.length - 1 - k];
    unitesParMontant[i] = unitesParMontant[i].minus(1);
  }
  return { arrondis: unitesParMontant.map((u) => u.times(pas)), cibleArrondie };
}
