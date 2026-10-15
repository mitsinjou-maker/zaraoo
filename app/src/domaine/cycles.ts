import type { ResultatCycle } from "@partage-jirama/moteur";
import { nouvelId, relevesVides, type BrouillonCycle } from "./brouillon";
import { PARAMETRES_SAISIS_PAR_DEFAUT, type ParametresSaisis } from "./reglages";

/** Cycle validé : brouillon et résultat figés, tels qu'ils étaient au moment de la validation. */
export interface CycleValide {
  id: string;
  version: 1;
  mois: string;
  dateDebut: string;
  dateFin: string;
  kwh: number;
  totalFacture: number;
  nbFoyers: number;
  /** Validé sur une facture estimée par la JIRAMA : le cycle suivant le régularise. */
  estimee?: boolean;
  /** Date et heure de validation (ISO). */
  valideLe: string;
  /** Même instant en millisecondes : les règles Firestore s'en servent pour limiter l'annulation. */
  valideLeMs: number;
  /** Règles de répartition en vigueur lors de la validation. */
  parametres?: ParametresSaisis;
  brouillon: BrouillonCycle;
  resultat: ResultatCycle;
}

export type ResumeCycle = Omit<CycleValide, "brouillon" | "resultat">;

export function resumer(c: CycleValide): ResumeCycle {
  const { brouillon: _b, resultat: _r, ...resume } = c;
  return resume;
}

/** Fige le cycle en cours. Le résultat doit être valide (`ok`). */
export function figerCycle(
  b: BrouillonCycle,
  resultat: ResultatCycle,
  maintenant = new Date(),
  parametres: ParametresSaisis = PARAMETRES_SAISIS_PAR_DEFAUT,
): CycleValide {
  if (!resultat.ok || !b.facture.dateDebut || !b.facture.dateFin) {
    throw new Error("Seul un cycle complet et sans erreur peut être validé.");
  }
  return {
    id: `${b.facture.dateFin}-${nouvelId().slice(0, 8)}`,
    version: 1,
    mois: b.facture.mois || `Cycle du ${b.facture.dateFin}`,
    dateDebut: b.facture.dateDebut,
    dateFin: b.facture.dateFin,
    kwh: resultat.facture?.kwh ?? 0,
    totalFacture: resultat.controleFacture?.totalSaisi ?? 0,
    nbFoyers: resultat.participants.length,
    estimee: b.facture.estimee,
    valideLe: maintenant.toISOString(),
    valideLeMs: maintenant.getTime(),
    parametres: { ...parametres },
    brouillon: structuredClone(b),
    resultat: structuredClone(resultat),
  };
}

/** Délai pendant lequel la dernière validation peut être annulée (aussi imposé par firestore.rules). */
export const DELAI_ANNULATION_JOURS = 30;

/**
 * Une validation peut être annulée si le cycle est le plus récent et validé depuis moins de
 * 30 jours. Les cycles plus anciens restent figés définitivement.
 */
export function peutEtreAnnule(cycle: ResumeCycle, plusRecentId: string | undefined, maintenant = new Date()): boolean {
  return (
    cycle.id === plusRecentId &&
    typeof cycle.valideLeMs === "number" &&
    maintenant.getTime() - cycle.valideLeMs < DELAI_ANNULATION_JOURS * 86_400_000
  );
}

/**
 * Prépare le brouillon du cycle suivant : il commence où le cycle validé s'arrête (date et index du
 * compteur JIRAMA, index de chaque sous-compteur) et reprend les logements, le tarif et les occupants
 * encore présents.
 *
 * Si le cycle a été validé sur une facture estimée, le suivant est une **régularisation** : la
 * prochaine facture réelle de la JIRAMA repart du dernier index réel, donc le brouillon repart du
 * début du cycle estimé, et chaque foyer sera crédité de ce qu'il a payé pour ce cycle.
 */
export function brouillonSuivant(b: BrouillonCycle, cycle?: CycleValide): BrouillonCycle {
  const regulariser = b.facture.estimee && cycle !== undefined;
  const fin = b.facture.dateFin;
  const debut = regulariser ? b.facture.dateDebut : fin;
  return {
    version: 1,
    exemple: false,
    facture: {
      numero: "",
      mois: "",
      dateDebut: debut,
      dateFin: null,
      indexDebut: regulariser ? b.facture.indexDebut : b.facture.indexFin,
      indexFin: null,
      coefficientTranche: b.facture.coefficientTranche,
      puissanceKw: b.facture.puissanceKw,
      estimee: false,
      totalSaisi: null,
      deductionEstimee: regulariser ? cycle.totalFacture : null,
      regularisation: regulariser
        ? {
            cycleId: cycle.id,
            mois: cycle.mois,
            totalEstime: cycle.totalFacture,
            credits: cycle.resultat.participants.map((p) => ({
              occupantId: p.occupantId,
              nom: p.nom ?? p.occupantId,
              montant: p.totalArrondi,
            })),
          }
        : null,
    },
    tarif: structuredClone(b.tarif),
    logements: structuredClone(b.logements),
    occupations: b.occupations
      .filter((o) => o.sortie === null || (debut !== null && o.sortie > debut))
      .map((o) => ({ ...o })),
    releves: Object.fromEntries(
      b.logements.map((l) => {
        const r = b.releves[l.id];
        // Une régularisation reprend les relevés du cycle estimé (début, déménagements, remplacement).
        return [
          l.id,
          regulariser
            ? {
                ...relevesVides(),
                indexDebut: r?.indexDebut ?? null,
                intermediaires: { ...(r?.intermediaires ?? {}) },
                remplacement: r?.remplacement ? { ...r.remplacement } : null,
              }
            : { ...relevesVides(), indexDebut: r?.indexFin ?? null },
        ];
      }),
    ),
    parametres: { forcerFacture: false, forcerEcart: false },
  };
}
