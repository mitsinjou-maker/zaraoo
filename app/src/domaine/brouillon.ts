import {
  calculerFacture,
  joursEntre,
  repartirCycle,
  type DateISO,
  type EntreeCycle,
  type FactureCalculee,
  type GrilleTarifaire,
  type RelevesLogement,
  type ResultatCycle,
} from "@partage-jirama/moteur";
import { PARAMETRES_SAISIS_PAR_DEFAUT, versParametresMoteur, type ParametresSaisis } from "./reglages";

// ---------------------------------------------------------------------------
// Brouillon d'un cycle, tel que l'admin le saisit. Les valeurs non encore saisies sont `null`.
// ---------------------------------------------------------------------------

export interface Logement {
  /** Code affiché, par exemple « L01 ». */
  id: string;
  couleur: string;
  /** Description libre, par exemple « RDC gauche ». */
  nom?: string;
  /** Numéro inscrit sur le sous-compteur. */
  numeroCompteur?: string;
}

export interface OccupationSaisie {
  id: string;
  occupantId: string;
  nom: string;
  logementId: string;
  entree: DateISO;
  sortie: DateISO | null;
}

export interface TarifSaisi {
  nom: string;
  tranches: { plafondKwh: number | null; prixKwh: number | null }[];
  fraisFixes: { libelle: string; prixUnitaire: number | null; parKw: boolean }[];
  /** Taxes proportionnelles au montant de l'énergie, en pourcentage. */
  taxes: { libelle: string; tauxPourcent: number | null }[];
  tvaPourcent: number | null;
  franchiseKwh: number;
}

export interface RelevesSaisis {
  /** Index au début du cycle (relevé de fin du cycle précédent). */
  indexDebut: number | null;
  /** Date du relevé de fin ; par défaut, la date du nouvel index JIRAMA. */
  dateFin: DateISO | null;
  indexFin: number | null;
  /** Relevés aux jours de déménagement, par date. */
  intermediaires: Record<DateISO, number | null>;
  /** Sous-compteur remplacé pendant le cycle (spécification §8). */
  remplacement?: RemplacementCompteur | null;
}

/**
 * Remplacement d'un sous-compteur : dernier index de l'ancien et premier index du nouveau, le même
 * jour. Les relevés saisis après cette date sont lus sur le nouveau compteur.
 */
export interface RemplacementCompteur {
  date: DateISO | null;
  indexAncien: number | null;
  indexNouveau: number | null;
}

/**
 * Régularisation d'une facture estimée (spécification §8) : la facture suivante couvre aussi la
 * période estimée ; chaque foyer est crédité de ce qu'il a payé pour le cycle estimé.
 */
export interface Regularisation {
  cycleId: string;
  mois: string;
  /** TOTAL (3) de la facture estimée. */
  totalEstime: number;
  credits: { occupantId: string; nom: string; montant: number }[];
}

export interface BrouillonCycle {
  version: 1;
  exemple: boolean;
  facture: {
    numero: string;
    mois: string;
    dateDebut: DateISO | null;
    dateFin: DateISO | null;
    indexDebut: number | null;
    indexFin: number | null;
    coefficientTranche: number | null;
    puissanceKw: number | null;
    estimee: boolean;
    totalSaisi: number | null;
    /** Ligne (4) « Déduction sur facture estimée antérieure ». */
    deductionEstimee?: number | null;
    /** Présent quand ce cycle régularise un cycle validé sur facture estimée. */
    regularisation?: Regularisation | null;
  };
  tarif: TarifSaisi;
  logements: Logement[];
  occupations: OccupationSaisie[];
  releves: Record<string, RelevesSaisis>;
  parametres: { forcerFacture: boolean; forcerEcart: boolean };
}

export const COULEURS_LOGEMENTS = ["#3FB59A", "#E3559A", "#8CC63F", "#5B7CF0", "#F08A3C", "#B07CE8", "#E8C547", "#4FB3D9"];

export function nouvelId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function relevesVides(): RelevesSaisis {
  return { indexDebut: null, dateFin: null, indexFin: null, intermediaires: {} };
}

/** Grille du tarif 20 « Économique » reconstituée à partir des factures de 2022. */
export function tarifParDefaut(): TarifSaisi {
  return {
    nom: "Tarif 20 Économique",
    tranches: [
      { plafondKwh: 130, prixKwh: 340 },
      { plafondKwh: 300, prixKwh: 560 },
      { plafondKwh: null, prixKwh: 764 },
    ],
    fraisFixes: [
      { libelle: "Redevance JIRAMA", prixUnitaire: 8000, parKw: false },
      { libelle: "Prime fixe", prixUnitaire: 3018, parKw: true },
    ],
    taxes: [
      { libelle: "Taxe communale", tauxPourcent: 3.5 },
      { libelle: "Surtaxe communale", tauxPourcent: 0.5 },
      { libelle: "Fonds national de l'énergie durable", tauxPourcent: 1.25 },
    ],
    tvaPourcent: 20,
    franchiseKwh: 100,
  };
}

export function brouillonVierge(): BrouillonCycle {
  return {
    version: 1,
    exemple: false,
    facture: {
      numero: "",
      mois: "",
      dateDebut: null,
      dateFin: null,
      indexDebut: null,
      indexFin: null,
      coefficientTranche: 1,
      puissanceKw: null,
      estimee: false,
      totalSaisi: null,
    },
    tarif: tarifParDefaut(),
    logements: [],
    occupations: [],
    releves: {},
    parametres: { forcerFacture: false, forcerEcart: false },
  };
}

// ---------------------------------------------------------------------------
// Lecture du brouillon
// ---------------------------------------------------------------------------

export type StatutPresence = "present" | "entrant" | "sortant" | "passage";

export interface OccupationDuCycle {
  occupation: OccupationSaisie;
  jours: number;
  poids: number;
  statut: StatutPresence;
}

/** Occupations qui chevauchent le cycle, avec jours de présence et poids. */
export function occupationsDuCycle(b: BrouillonCycle): OccupationDuCycle[] {
  const { dateDebut, dateFin } = b.facture;
  if (!dateDebut || !dateFin || joursEntre(dateDebut, dateFin) <= 0) return [];
  const n = joursEntre(dateDebut, dateFin);
  const resultat: OccupationDuCycle[] = [];
  for (const o of b.occupations) {
    const debut = o.entree > dateDebut ? o.entree : dateDebut;
    const fin = o.sortie && o.sortie < dateFin ? o.sortie : dateFin;
    const jours = joursEntre(debut, fin);
    if (jours <= 0) continue;
    const entrant = o.entree > dateDebut;
    const sortant = o.sortie !== null && o.sortie < dateFin;
    const statut: StatutPresence = entrant && sortant ? "passage" : entrant ? "entrant" : sortant ? "sortant" : "present";
    resultat.push({ occupation: o, jours, poids: jours / n, statut });
  }
  const ordre = new Map(b.logements.map((l, i) => [l.id, i]));
  return resultat.sort(
    (x, y) =>
      (ordre.get(x.occupation.logementId) ?? 0) - (ordre.get(y.occupation.logementId) ?? 0) ||
      x.occupation.entree.localeCompare(y.occupation.entree),
  );
}

/** Jours de déménagement à l'intérieur du cycle, pour lesquels un relevé intermédiaire est demandé. */
export function datesIntermediaires(b: BrouillonCycle, logementId: string): DateISO[] {
  const { dateDebut, dateFin } = b.facture;
  if (!dateDebut || !dateFin) return [];
  const dates = new Set<DateISO>();
  for (const o of b.occupations.filter((x) => x.logementId === logementId)) {
    for (const d of [o.entree, o.sortie]) {
      if (d && d > dateDebut && d < dateFin) dates.add(d);
    }
  }
  return [...dates].sort();
}

/** Valeur à ajouter aux index du nouveau compteur pour les ramener sur l'échelle de l'ancien. */
export function decalageRemplacement(r: RelevesSaisis): number | null {
  const rem = r.remplacement;
  return rem && rem.indexAncien !== null && rem.indexNouveau !== null ? rem.indexAncien - rem.indexNouveau : null;
}

/** Index ramené sur l'échelle de l'ancien compteur s'il a été relevé après un remplacement. */
export function indexCorrige(r: RelevesSaisis, date: DateISO | null, index: number): number {
  const rem = r.remplacement;
  const decalage = decalageRemplacement(r);
  return rem?.date && date && date > rem.date && decalage !== null ? index + decalage : index;
}

function versGrille(tarif: TarifSaisi, puissanceKw: number): GrilleTarifaire | null {
  const { tranches, fraisFixes, taxes, tvaPourcent } = tarif;
  if (tranches.some((t) => t.prixKwh === null)) return null;
  if (tranches.slice(0, -1).some((t) => t.plafondKwh === null)) return null;
  if (fraisFixes.some((f) => f.prixUnitaire === null) || taxes.some((t) => t.tauxPourcent === null)) return null;
  if (tvaPourcent === null) return null;
  return {
    nom: tarif.nom,
    tranches: tranches.map((t, i) => ({ plafondKwh: i === tranches.length - 1 ? null : t.plafondKwh, prixKwh: t.prixKwh! })),
    coefficientTranche: 1,
    fraisFixes: fraisFixes.map((f) => ({ libelle: f.libelle, prixUnitaire: f.prixUnitaire!, quantite: f.parKw ? puissanceKw : 1 })),
    taxes: taxes.map((t) => ({ libelle: t.libelle, assiette: "energie" as const, taux: t.tauxPourcent! / 100 })),
    tva: { taux: tvaPourcent / 100, franchiseKwh: tarif.franchiseKwh },
  };
}

export type Section = "facture" | "occupants" | "releves";

export interface Manquant {
  section: Section;
  message: string;
  logementId?: string;
}

export interface Analyse {
  /** Vrai quand les deux dates de la facture sont saisies et cohérentes : la présence peut être calculée. */
  datesCompletes: boolean;
  joursCycle: number | null;
  kwhFactures: number | null;
  facture: FactureCalculee | null;
  occupations: OccupationDuCycle[];
  manquants: Manquant[];
  releves: { saisis: number; attendus: number };
  /** Règles de répartition appliquées. */
  parametres: ParametresSaisis;
  /** Calcul complet du moteur, disponible dès que toutes les données obligatoires sont saisies. */
  resultat: ResultatCycle | null;
}

/** Contrôle le brouillon et, s'il est complet, lance le moteur de répartition. */
export function analyserBrouillon(b: BrouillonCycle, parametres: ParametresSaisis = PARAMETRES_SAISIS_PAR_DEFAUT): Analyse {
  const manquants: Manquant[] = [];
  const f = b.facture;
  const manque = (section: Section, message: string, logementId?: string) => manquants.push({ section, message, logementId });

  if (!f.dateDebut || !f.dateFin) manque("facture", "Dates des index JIRAMA à saisir.");
  if (f.indexDebut === null || f.indexFin === null) manque("facture", "Index du compteur JIRAMA à saisir.");
  if (f.puissanceKw === null) manque("facture", "Puissance souscrite à saisir.");
  if (f.coefficientTranche === null) manque("facture", "Coefficient de tranche à saisir.");
  if (f.totalSaisi === null) manque("facture", "Total imprimé sur la facture à saisir.");

  const joursCycle = f.dateDebut && f.dateFin ? joursEntre(f.dateDebut, f.dateFin) : null;
  if (joursCycle !== null && joursCycle <= 0) manque("facture", "La date du nouvel index doit suivre celle de l'ancien.");
  const kwhFactures = f.indexDebut !== null && f.indexFin !== null ? f.indexFin - f.indexDebut : null;

  const grilleBase = versGrille(b.tarif, f.puissanceKw ?? 0);
  if (!grilleBase) manque("facture", "Un prix ou un taux de la facture est vide.");
  const grille = grilleBase && f.coefficientTranche !== null ? { ...grilleBase, coefficientTranche: f.coefficientTranche } : null;
  const facture = grille && kwhFactures !== null && kwhFactures >= 0 && f.puissanceKw !== null ? calculerFacture(kwhFactures, grille) : null;

  const occupations = occupationsDuCycle(b);
  if (b.logements.length === 0) manque("occupants", "Aucun logement n'est déclaré.");

  let saisis = 0;
  let attendus = 0;
  const relevesMoteur: RelevesLogement[] = [];
  for (const l of b.logements) {
    const r = b.releves[l.id] ?? relevesVides();
    const dateFinReleve = r.dateFin ?? f.dateFin;
    attendus += 2;
    if (r.indexDebut !== null) saisis++;
    else manque("releves", `${l.id} : index de début à saisir.`, l.id);
    if (r.indexFin !== null) saisis++;
    else manque("releves", `${l.id} : index de fin à saisir.`, l.id);
    const intermediaires = datesIntermediaires(b, l.id);
    attendus += intermediaires.length;
    saisis += intermediaires.filter((d) => r.intermediaires[d] != null).length;

    const rem = r.remplacement;
    if (rem) {
      attendus += 2;
      saisis += (rem.indexAncien !== null ? 1 : 0) + (rem.indexNouveau !== null ? 1 : 0);
      if (!rem.date || rem.indexAncien === null || rem.indexNouveau === null) {
        manque("releves", `${l.id} : compteur remplacé, date et index à saisir.`, l.id);
      } else if (f.dateDebut && f.dateFin && !(rem.date > f.dateDebut && rem.date < f.dateFin)) {
        manque("releves", `${l.id} : la date du remplacement doit être à l'intérieur du cycle.`, l.id);
      }
    }

    if (r.indexDebut !== null && r.indexFin !== null && f.dateDebut && dateFinReleve) {
      // Index du nouveau compteur ramenés sur l'échelle de l'ancien : le moteur voit une série continue.
      const points = intermediaires
        .filter((d) => r.intermediaires[d] != null)
        .map((d) => ({ date: d, index: indexCorrige(r, d, r.intermediaires[d]!) }));
      if (rem?.date && rem.indexAncien !== null) points.push({ date: rem.date, index: rem.indexAncien });
      relevesMoteur.push({
        logementId: l.id,
        debut: { date: f.dateDebut, index: r.indexDebut },
        fin: { date: dateFinReleve, index: indexCorrige(r, dateFinReleve, r.indexFin) },
        intermediaires: points,
      });
    }
  }

  let resultat: ResultatCycle | null = null;
  if (manquants.length === 0 && grille) {
    const entree: EntreeCycle = {
      cycle: {
        debut: f.dateDebut!,
        fin: f.dateFin!,
        indexPrincipalDebut: f.indexDebut!,
        indexPrincipalFin: f.indexFin!,
        totalFactureSaisi: f.totalSaisi!,
      },
      grille,
      occupations: b.occupations.map((o) => ({
        occupantId: o.occupantId,
        nom: o.nom,
        logementId: o.logementId,
        entree: o.entree,
        sortie: o.sortie,
      })),
      releves: relevesMoteur,
      parametres: {
        ...versParametresMoteur(parametres),
        forcerFacture: b.parametres.forcerFacture,
        forcerEcart: b.parametres.forcerEcart,
      },
    };
    resultat = repartirCycle(entree);
  }

  const datesCompletes = joursCycle !== null && joursCycle > 0;
  return {
    datesCompletes,
    joursCycle,
    kwhFactures,
    facture,
    occupations,
    manquants,
    releves: { saisis, attendus },
    parametres,
    resultat,
  };
}
