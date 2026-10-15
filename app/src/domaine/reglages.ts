import type { DateISO, ParametresRepartition } from "@partage-jirama/moteur";
import { nouvelId, tarifParDefaut, type TarifSaisi } from "./brouillon";
import { empreinte } from "./empreinte";

/** Grille tarifaire avec sa date d'entrée en vigueur (spécification §3.1). */
export interface GrilleDatee {
  id: string;
  nom: string;
  /** Premier jour où la grille s'applique (date de fin de la facture). */
  dateEffet: DateISO;
  tarif: TarifSaisi;
}

/** Règles de répartition modifiables par l'admin (spécification §3.2), en unités lisibles. */
export interface ParametresSaisis {
  /** Écart positif maximal, en % des kWh facturés. */
  seuilEcartPositifPourcent: number;
  /** Écart négatif maximal (valeur absolue), en %. */
  seuilEcartNegatifPourcent: number;
  /** Décalage toléré entre la date d'un relevé et celle de la facture, en jours. */
  toleranceJoursReleve: number;
  /** Différence tolérée entre la facture saisie et la facture recalculée, en Ariary. */
  toleranceFactureAr: number;
  /** Arrondi des montants à payer, en Ariary (1 ou 0,01 par exemple). */
  pasArrondiAr: number;
}

export interface Reglages {
  version: 1;
  grilles: GrilleDatee[];
  parametres: ParametresSaisis;
}

export const PARAMETRES_SAISIS_PAR_DEFAUT: ParametresSaisis = {
  seuilEcartPositifPourcent: 10,
  seuilEcartNegatifPourcent: 2,
  toleranceJoursReleve: 1,
  toleranceFactureAr: 1,
  pasArrondiAr: 1,
};

export function reglagesParDefaut(): Reglages {
  return {
    version: 1,
    grilles: [{ id: "tarif-20-2022", nom: "Tarif 20 Économique", dateEffet: "2022-01-01", tarif: tarifParDefaut() }],
    parametres: { ...PARAMETRES_SAISIS_PAR_DEFAUT },
  };
}

export function versParametresMoteur(p: ParametresSaisis): Partial<ParametresRepartition> {
  return {
    seuilEcartPositif: p.seuilEcartPositifPourcent / 100,
    seuilEcartNegatif: p.seuilEcartNegatifPourcent / 100,
    toleranceJoursReleve: p.toleranceJoursReleve,
    toleranceFacture: p.toleranceFactureAr,
    pasArrondi: p.pasArrondiAr,
  };
}

/** Grilles de la plus récente à la plus ancienne. */
export function grillesTriees(r: Reglages): GrilleDatee[] {
  return [...r.grilles].sort((a, b) => b.dateEffet.localeCompare(a.dateEffet));
}

/** Grille en vigueur à cette date (la plus récente déjà entrée en vigueur), ou la plus récente si la date est inconnue. */
export function grilleEnVigueur(r: Reglages, date: DateISO | null): GrilleDatee | undefined {
  const triees = grillesTriees(r);
  return date ? (triees.find((g) => g.dateEffet <= date) ?? triees.at(-1)) : triees[0];
}

/** Le tarif du cycle reprend-il exactement cette grille ? */
export function memeTarif(a: TarifSaisi, b: TarifSaisi): boolean {
  return empreinte({ ...a, nom: "" }) === empreinte({ ...b, nom: "" });
}

/** Copie d'une grille pour le cycle en cours (le nom de la grille suit). */
export function tarifDeGrille(g: GrilleDatee): TarifSaisi {
  return { ...structuredClone(g.tarif), nom: g.nom };
}

export function nouvelleGrille(base: GrilleDatee | undefined, dateEffet: DateISO): GrilleDatee {
  return {
    id: nouvelId(),
    nom: base ? `${base.nom} (copie)` : "Nouvelle grille",
    dateEffet,
    tarif: base ? structuredClone(base.tarif) : tarifParDefaut(),
  };
}

/** Problèmes qui empêchent d'utiliser une grille ; tableau vide si elle est complète et cohérente. */
export function verifierTarif(t: TarifSaisi): string[] {
  const erreurs: string[] = [];
  if (t.tranches.length === 0) erreurs.push("Il faut au moins une tranche.");
  let precedent = 0;
  t.tranches.forEach((tr, i) => {
    const derniere = i === t.tranches.length - 1;
    if (!derniere) {
      if (tr.plafondKwh === null || !(tr.plafondKwh > precedent)) {
        erreurs.push(`Tranche ${i + 1} : le plafond doit dépasser ${precedent} kWh.`);
      } else precedent = tr.plafondKwh;
    }
    if (tr.prixKwh === null || tr.prixKwh < 0) erreurs.push(`Tranche ${i + 1} : prix manquant.`);
  });
  t.fraisFixes.forEach((f, i) => {
    if (f.libelle.trim() === "") erreurs.push(`Frais fixe ${i + 1} : libellé manquant.`);
    if (f.prixUnitaire === null) erreurs.push(`${f.libelle || `Frais fixe ${i + 1}`} : montant manquant.`);
  });
  t.taxes.forEach((x, i) => {
    if (x.libelle.trim() === "") erreurs.push(`Taxe ${i + 1} : libellé manquant.`);
    if (x.tauxPourcent === null) erreurs.push(`${x.libelle || `Taxe ${i + 1}`} : taux manquant.`);
  });
  if (t.tvaPourcent === null) erreurs.push("Taux de TVA manquant.");
  if (!estNombre(t.franchiseKwh) || t.franchiseKwh < 0) erreurs.push("Franchise de TVA invalide.");
  return erreurs;
}

const estNombre = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

/** Message d'erreur pour un paramètre vide ou hors limites, sinon `null`. */
export function verifierParametres(p: ParametresSaisis): string | null {
  if (!Object.values(p).every(estNombre)) return "Toutes les règles de répartition doivent être remplies.";
  if (!(p.seuilEcartPositifPourcent > 0 && p.seuilEcartPositifPourcent <= 100)) return "Seuil d'écart positif : entre 0 et 100 %.";
  if (!(p.seuilEcartNegatifPourcent >= 0 && p.seuilEcartNegatifPourcent <= 100)) return "Seuil d'écart négatif : entre 0 et 100 %.";
  if (!(p.toleranceJoursReleve >= 0 && Number.isInteger(p.toleranceJoursReleve))) return "Tolérance sur les relevés : nombre entier de jours.";
  if (!(p.toleranceFactureAr >= 0)) return "Tolérance sur la facture : montant positif.";
  if (!(p.pasArrondiAr > 0)) return "Pas d'arrondi : montant positif.";
  return null;
}
