/** Date au format ISO `AAAA-MM-JJ`. */
export type DateISO = string;

// ---------------------------------------------------------------------------
// Grille tarifaire (spécification §2 et §3.1)
// ---------------------------------------------------------------------------

export interface Tranche {
  /** Plafond cumulé en kWh, avant coefficient de tranche. `null` pour la dernière tranche. */
  plafondKwh: number | null;
  prixKwh: number;
}

/** Frais indépendant de la consommation. Montant = prix unitaire × quantité. */
export interface FraisFixe {
  libelle: string;
  prixUnitaire: number;
  /** Quantité (ex. puissance souscrite en kW pour la prime fixe). 1 par défaut. */
  quantite?: number;
}

/** Taux exprimés en fraction : 0.035 = 3,5 %. */
export type Taxe =
  | { libelle: string; assiette: "energie"; taux: number }
  | { libelle: string; assiette: "fixe"; montant: number };

export interface GrilleTarifaire {
  nom: string;
  tranches: Tranche[];
  /** Multiplie les plafonds des tranches. 1 sur toutes les factures observées. */
  coefficientTranche: number;
  fraisFixes: FraisFixe[];
  taxes: Taxe[];
  tva: {
    taux: number;
    /** kWh exonérés de TVA, valorisés au prix de la première tranche. */
    franchiseKwh: number;
  };
}

// ---------------------------------------------------------------------------
// Facture recalculée
// ---------------------------------------------------------------------------

export interface LigneTranche {
  kwh: number;
  prixKwh: number;
  montant: number;
}

export interface LigneMontant {
  libelle: string;
  montant: number;
}

export interface FactureCalculee {
  kwh: number;
  tranches: LigneTranche[];
  energie: number;
  fraisFixes: LigneMontant[];
  /** Bloc (1) de la facture : énergie + frais fixes. */
  sousTotalJirama: number;
  taxes: LigneMontant[];
  /** Bloc (2) de la facture. */
  sousTotalTaxes: number;
  /** Montant exonéré de TVA. */
  franchiseTva: number;
  baseTva: number;
  tva: number;
  /** TOTAL (3) = (1) + (2) + TVA. */
  total: number;
}

// ---------------------------------------------------------------------------
// Entrées d'un cycle
// ---------------------------------------------------------------------------

export interface Occupation {
  occupantId: string;
  nom?: string;
  logementId: string;
  /** Jour d'arrivée. Ce jour compte pour l'occupant qui arrive. */
  entree: DateISO;
  /** Jour de départ, exclu de la présence. Absent = toujours présent. */
  sortie?: DateISO | null;
}

export interface Releve {
  date: DateISO;
  index: number;
}

export interface RelevesLogement {
  logementId: string;
  /** Index en début de cycle (en général le relevé de fin du cycle précédent). */
  debut: Releve;
  /** Index en fin de cycle, relevé le jour de l'index JIRAMA. */
  fin: Releve;
  /** Relevés faits en cours de cycle, par exemple lors d'un déménagement. */
  intermediaires?: Releve[];
}

export interface ParametresRepartition {
  /** Écart positif maximal toléré, en fraction des kWh facturés. */
  seuilEcartPositif: number;
  /** Écart négatif maximal toléré (valeur absolue), en fraction des kWh facturés. */
  seuilEcartNegatif: number;
  /** Décalage toléré, en jours, entre la date d'un relevé et la date de la facture. */
  toleranceJoursReleve: number;
  /** Différence tolérée, en Ariary, entre la facture saisie et la facture recalculée. */
  toleranceFacture: number;
  /** Pas d'arrondi des parts, en Ariary (1 ou 0,01). */
  pasArrondi: number;
  /** L'admin accepte une facture saisie différente de la facture recalculée. */
  forcerFacture: boolean;
  /** L'admin accepte un écart au-delà des seuils. */
  forcerEcart: boolean;
}

export interface EntreeCycle {
  cycle: {
    /** Date de l'ancien index JIRAMA. */
    debut: DateISO;
    /** Date du nouvel index JIRAMA. */
    fin: DateISO;
    indexPrincipalDebut: number;
    indexPrincipalFin: number;
    /** TOTAL (3) imprimé sur la facture. C'est toujours ce montant qui est réparti. */
    totalFactureSaisi: number;
  };
  grille: GrilleTarifaire;
  occupations: Occupation[];
  releves: RelevesLogement[];
  parametres?: Partial<ParametresRepartition>;
}

// ---------------------------------------------------------------------------
// Résultat
// ---------------------------------------------------------------------------

export type NiveauDiagnostic = "info" | "avertissement" | "erreur";

export type CodeDiagnostic =
  | "GRILLE_INVALIDE"
  | "PRIX_NON_CROISSANTS"
  | "CYCLE_DATES_INVALIDES"
  | "INDEX_PRINCIPAL_EN_BAISSE"
  | "OCCUPATION_INVALIDE"
  | "OCCUPATIONS_CHEVAUCHEES"
  | "RELEVES_MANQUANTS"
  | "RELEVES_INVALIDES"
  | "INDEX_EN_BAISSE"
  | "RELEVE_DATE_DECALEE"
  | "CONSOMMATION_ESTIMEE"
  | "CONSOMMATION_NON_ATTRIBUEE"
  | "AUCUN_PARTICIPANT"
  | "FACTURE_INCOHERENTE"
  | "ECART_ELEVE"
  | "ECART_NEGATIF";

export interface Diagnostic {
  code: CodeDiagnostic;
  niveau: NiveauDiagnostic;
  message: string;
  logementId?: string;
  occupantId?: string;
}

export interface ResultatParticipant {
  occupantId: string;
  nom?: string;
  logementIds: string[];
  jours: number;
  /** Jours de présence / jours du cycle. */
  poids: number;
  kwhMesures: number;
  /** Vrai si une partie de la consommation est estimée faute de relevé. */
  estime: boolean;
  partEcartKwh: number;
  kwhCorriges: number;
  /** kWh attribués à chaque tranche, dans l'ordre de la grille. */
  kwhParTranche: number[];
  energie: number;
  taxes: LigneMontant[];
  totalTaxes: number;
  fraisFixes: LigneMontant[];
  totalFraisFixes: number;
  franchiseTva: number;
  /** Énergie + taxes + frais fixes, avant TVA. */
  assietteTva: number;
  tva: number;
  /** Part de la différence entre la facture saisie et la somme calculée. */
  ajustement: number;
  /** Montant exact, avant arrondi. */
  total: number;
  /** Montant à payer, arrondi au pas choisi. */
  totalArrondi: number;
  prixMoyenKwh: number;
  /** À titre indicatif : facture de ce foyer s'il avait son propre compteur JIRAMA. */
  totalSiCompteurIndividuel: number;
}

export interface ResultatCycle {
  /** Faux si au moins un diagnostic est une erreur : le cycle ne peut pas être validé. */
  ok: boolean;
  diagnostics: Diagnostic[];
  joursCycle: number;
  facture: FactureCalculee | null;
  controleFacture: {
    totalSaisi: number;
    totalRecalcule: number;
    difference: number;
    coherent: boolean;
  } | null;
  ecart: {
    compteurPrincipalKwh: number;
    sommeParticipantsKwh: number;
    /** kWh des sous-compteurs pendant les périodes sans occupant (inclus dans l'écart). */
    nonAttribueKwh: number;
    ecartKwh: number;
    /** Écart / kWh facturés, en fraction. */
    ecartRelatif: number;
    mode: "egal" | "proportionnel";
  } | null;
  participants: ResultatParticipant[];
  totaux: {
    kwh: number;
    energie: number;
    taxes: number;
    fraisFixes: number;
    franchiseTva: number;
    tva: number;
    ajustement: number;
    total: number;
    totalArrondi: number;
    /** Total saisi − total arrondi : ce que l'arrondi au pas choisi ne permet pas de répartir. */
    reliquatArrondi: number;
  } | null;
}
