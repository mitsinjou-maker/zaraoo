import { arrondirPlusFortReste } from "./arrondi";
import { estDateValide, joursEntre } from "./dates";
import { dec, formatFr, somme, ZERO, type Dec } from "./decimal";
import { calculerFactureInterne, versFactureCalculee } from "./facture";
import { mesurerParticipants } from "./presence";
import { partageSeriel } from "./seriel";
import { bornesTranches, validerGrille } from "./tarif";
import type { Diagnostic, EntreeCycle, ParametresRepartition, ResultatCycle, ResultatParticipant } from "./types";

export const PARAMETRES_PAR_DEFAUT: ParametresRepartition = {
  seuilEcartPositif: 0.1,
  seuilEcartNegatif: 0.02,
  toleranceJoursReleve: 1,
  toleranceFacture: 1,
  pasArrondi: 1,
  forcerFacture: false,
  forcerEcart: false,
};

/**
 * Calcule la répartition complète d'un cycle (spécification §5).
 *
 * Le résultat est toujours renvoyé, avec ses diagnostics. S'il contient une erreur, `ok` vaut
 * `false` et le cycle ne doit pas être validé ; les montants, quand ils ont pu être calculés,
 * servent alors d'aperçu.
 */
export function repartirCycle(entree: EntreeCycle): ResultatCycle {
  const p: ParametresRepartition = { ...PARAMETRES_PAR_DEFAUT, ...entree.parametres };
  const { cycle, grille } = entree;
  const diagnostics: Diagnostic[] = [...validerGrille(grille)];
  const aErreur = () => diagnostics.some((d) => d.niveau === "erreur");

  const resultat: ResultatCycle = {
    ok: false,
    diagnostics,
    joursCycle: 0,
    facture: null,
    controleFacture: null,
    ecart: null,
    participants: [],
    totaux: null,
  };

  // --- Cycle et compteur principal
  if (!estDateValide(cycle.debut) || !estDateValide(cycle.fin) || joursEntre(cycle.debut, cycle.fin) <= 0) {
    diagnostics.push({
      code: "CYCLE_DATES_INVALIDES",
      niveau: "erreur",
      message: "Les dates du cycle sont invalides : la date du nouvel index doit suivre celle de l'ancien.",
    });
    return resultat;
  }
  resultat.joursCycle = joursEntre(cycle.debut, cycle.fin);

  const kwhFactures = dec(cycle.indexPrincipalFin).minus(cycle.indexPrincipalDebut);
  if (kwhFactures.isNegative()) {
    diagnostics.push({
      code: "INDEX_PRINCIPAL_EN_BAISSE",
      niveau: "erreur",
      message: "Le nouvel index du compteur JIRAMA est inférieur à l'ancien.",
    });
  }
  if (aErreur()) return resultat;

  // --- Étape 0 : contrôle de la facture
  const facture = calculerFactureInterne(kwhFactures, grille);
  const totalSaisi = dec(cycle.totalFactureSaisi);
  const difference = totalSaisi.minus(facture.total);
  const coherent = difference.abs().lessThanOrEqualTo(p.toleranceFacture);
  resultat.facture = versFactureCalculee(facture);
  resultat.controleFacture = {
    totalSaisi: totalSaisi.toNumber(),
    totalRecalcule: facture.total.toNumber(),
    difference: difference.toNumber(),
    coherent,
  };
  if (!coherent) {
    diagnostics.push({
      code: "FACTURE_INCOHERENTE",
      niveau: p.forcerFacture ? "avertissement" : "erreur",
      message: `La facture saisie (${formatFr(totalSaisi, 2)} Ar) diffère de la facture recalculée (${formatFr(facture.total, 2)} Ar) de ${formatFr(difference, 2)} Ar. Vérifiez les prix, la puissance souscrite ou une ligne oubliée.`,
    });
  }

  // --- Étapes 1 et 2 : participants et consommations mesurées
  const presence = mesurerParticipants(cycle, entree.occupations, entree.releves, p.toleranceJoursReleve);
  diagnostics.push(...presence.diagnostics);
  if (presence.diagnostics.some((d) => d.niveau === "erreur")) return resultat;
  const participants = presence.participants;
  if (participants.length === 0) {
    diagnostics.push({ code: "AUCUN_PARTICIPANT", niveau: "erreur", message: "Aucun occupant n'est présent pendant ce cycle." });
    return resultat;
  }

  // --- Étape 3 : écart
  const kwhMesures = somme(participants.map((x) => x.kwhMesures));
  const ecart = kwhFactures.minus(kwhMesures);
  const poidsTotal = somme(participants.map((x) => x.poids));
  const proportionnel = ecart.isNegative() && kwhMesures.greaterThan(0);
  const kwhCorriges = participants.map((x) =>
    proportionnel
      ? x.kwhMesures.times(kwhFactures).dividedBy(kwhMesures)
      : x.kwhMesures.plus(ecart.times(x.poids).dividedBy(poidsTotal)),
  );
  const ecartRelatif = kwhFactures.isZero() ? (ecart.isZero() ? ZERO : dec(-1)) : ecart.dividedBy(kwhFactures);
  resultat.ecart = {
    compteurPrincipalKwh: kwhFactures.toNumber(),
    sommeParticipantsKwh: kwhMesures.toNumber(),
    nonAttribueKwh: presence.nonAttribueKwh.toNumber(),
    ecartKwh: ecart.toNumber(),
    ecartRelatif: ecartRelatif.toNumber(),
    mode: proportionnel ? "proportionnel" : "egal",
  };
  const pourcent = formatFr(ecartRelatif.times(100), 1);
  if (ecartRelatif.greaterThan(p.seuilEcartPositif)) {
    diagnostics.push({
      code: "ECART_ELEVE",
      niveau: p.forcerEcart ? "avertissement" : "erreur",
      message: `L'écart atteint ${pourcent} % des kWh facturés (seuil ${p.seuilEcartPositif * 100} %). Vérifiez les relevés avant de valider.`,
    });
  } else if (ecartRelatif.lessThan(-p.seuilEcartNegatif)) {
    diagnostics.push({
      code: "ECART_NEGATIF",
      niveau: p.forcerEcart ? "avertissement" : "erreur",
      message: `Les sous-compteurs dépassent le compteur JIRAMA (${pourcent} %) : erreur de relevé ou de compteur probable.`,
    });
  }

  // --- Étape 4 : énergie, partage sériel
  const tranches = bornesTranches(grille);
  const parts = partageSeriel(
    participants.map((x, i) => ({ kwh: kwhCorriges[i], poids: x.poids })),
    tranches,
  );
  const energieTotale = somme(parts.map((x) => x.montant));
  const fractionPoids = participants.map((x) => x.poids.dividedBy(poidsTotal));
  const fractionEnergie = energieTotale.isZero()
    ? fractionPoids
    : parts.map((x) => x.montant.dividedBy(energieTotale));

  // --- Étapes 5 et 6 : taxes et frais fixes
  const taxes = participants.map((_, i) =>
    facture.taxes.map((t) => ({
      libelle: t.libelle,
      montant: t.montant.times(t.assiette === "energie" ? fractionEnergie[i] : fractionPoids[i]),
    })),
  );
  const fraisFixes = participants.map((_, i) =>
    facture.fraisFixes.map((f) => ({ libelle: f.libelle, montant: f.montant.times(fractionPoids[i]) })),
  );

  // --- Étape 7 : TVA
  const assiettes = participants.map((_, i) =>
    parts[i].montant.plus(somme(taxes[i].map((t) => t.montant))).plus(somme(fraisFixes[i].map((f) => f.montant))),
  );
  const franchises = repartirFranchise(facture.franchiseTva, assiettes, participants.map((x) => x.poids));
  const tva = assiettes.map((a, i) => a.minus(franchises[i]).times(grille.tva.taux));

  // --- Étape 8 : ajustement et arrondis
  const exacts = assiettes.map((a, i) => a.plus(tva[i]));
  const sommeExacts = somme(exacts);
  const aAjuster = totalSaisi.minus(sommeExacts);
  const ajustements = exacts.map((x, i) =>
    aAjuster.times(sommeExacts.isZero() ? fractionPoids[i] : x.dividedBy(sommeExacts)),
  );
  const totaux = exacts.map((x, i) => x.plus(ajustements[i]));
  const { arrondis, cibleArrondie } = arrondirPlusFortReste(totaux, totalSaisi, dec(p.pasArrondi));

  resultat.participants = participants.map((x, i): ResultatParticipant => ({
    occupantId: x.occupantId,
    nom: x.nom,
    logementIds: x.logementIds,
    jours: x.jours,
    poids: x.poids.toNumber(),
    kwhMesures: x.kwhMesures.toNumber(),
    estime: x.estime,
    partEcartKwh: kwhCorriges[i].minus(x.kwhMesures).toNumber(),
    kwhCorriges: kwhCorriges[i].toNumber(),
    kwhParTranche: parts[i].kwhParTranche.map((q) => q.toNumber()),
    energie: parts[i].montant.toNumber(),
    taxes: taxes[i].map((t) => ({ libelle: t.libelle, montant: t.montant.toNumber() })),
    totalTaxes: somme(taxes[i].map((t) => t.montant)).toNumber(),
    fraisFixes: fraisFixes[i].map((f) => ({ libelle: f.libelle, montant: f.montant.toNumber() })),
    totalFraisFixes: somme(fraisFixes[i].map((f) => f.montant)).toNumber(),
    franchiseTva: franchises[i].toNumber(),
    assietteTva: assiettes[i].toNumber(),
    tva: tva[i].toNumber(),
    ajustement: ajustements[i].toNumber(),
    total: totaux[i].toNumber(),
    totalArrondi: arrondis[i].toNumber(),
    prixMoyenKwh: kwhCorriges[i].isZero() ? 0 : totaux[i].dividedBy(kwhCorriges[i]).toNumber(),
    totalSiCompteurIndividuel: calculerFactureInterne(x.kwhMesures, grille).total.toNumber(),
  }));

  resultat.totaux = {
    kwh: somme(kwhCorriges).toNumber(),
    energie: energieTotale.toNumber(),
    taxes: somme(taxes.flat().map((t) => t.montant)).toNumber(),
    fraisFixes: somme(fraisFixes.flat().map((f) => f.montant)).toNumber(),
    franchiseTva: somme(franchises).toNumber(),
    tva: somme(tva).toNumber(),
    ajustement: somme(ajustements).toNumber(),
    total: somme(totaux).toNumber(),
    totalArrondi: cibleArrondie.toNumber(),
    reliquatArrondi: totalSaisi.minus(cibleArrondie).toNumber(),
  };
  resultat.ok = !aErreur();
  return resultat;
}

/**
 * Répartit le montant exonéré de TVA selon les poids de présence, sans qu'un participant
 * reçoive plus que son assiette : le surplus va aux autres, toujours selon leurs poids
 * (spécification §5.8).
 */
export function repartirFranchise(franchise: Dec, plafonds: Dec[], poids: Dec[]): Dec[] {
  const attribue = plafonds.map(() => ZERO);
  let restant = franchise;
  let actifs = plafonds.map((_, i) => i).filter((i) => plafonds[i].greaterThan(0));

  while (restant.greaterThan(0) && actifs.length > 0) {
    const poidsActifs = somme(actifs.map((i) => poids[i]));
    const part = (i: number) => restant.times(poids[i]).dividedBy(poidsActifs);
    const satures = actifs.filter((i) => part(i).greaterThanOrEqualTo(plafonds[i]));
    if (satures.length === 0) {
      for (const i of actifs) attribue[i] = part(i);
      break;
    }
    for (const i of satures) {
      attribue[i] = plafonds[i];
      restant = restant.minus(plafonds[i]);
    }
    actifs = actifs.filter((i) => !satures.includes(i));
  }
  return attribue;
}
