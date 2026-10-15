import { dec, somme, ZERO, type Dec } from "./decimal";
import { estDateValide, joursEntre, numeroJour } from "./dates";
import type { DateISO, Diagnostic, Occupation, RelevesLogement } from "./types";

export interface ParticipantMesure {
  occupantId: string;
  nom?: string;
  logementIds: string[];
  jours: number;
  /** Jours de présence / jours du cycle. */
  poids: Dec;
  kwhMesures: Dec;
  estime: boolean;
}

export interface ResultatPresence {
  participants: ParticipantMesure[];
  /** kWh relevés pendant les périodes sans occupant. */
  nonAttribueKwh: Dec;
  diagnostics: Diagnostic[];
}

interface Point {
  jour: number;
  index: Dec;
}

/**
 * Étapes 1 et 2 du calcul (spécification §5.2 et §5.3) : participants, poids de présence
 * et consommation mesurée de chacun.
 *
 * Le relevé de début est rattaché au premier jour du cycle et celui de fin au dernier.
 * Sans relevé au jour d'un déménagement, l'index de ce jour est interpolé entre les relevés
 * voisins (partage au prorata des jours) et la consommation est marquée « estimée ».
 */
export function mesurerParticipants(
  cycle: { debut: DateISO; fin: DateISO },
  occupations: Occupation[],
  releves: RelevesLogement[],
  toleranceJoursReleve: number,
): ResultatPresence {
  const diagnostics: Diagnostic[] = [];
  const debutCycle = numeroJour(cycle.debut);
  const finCycle = numeroJour(cycle.fin);
  const joursCycle = finCycle - debutCycle;

  // --- Relevés : validation et construction des points d'index par logement
  const pointsParLogement = new Map<string, Point[]>();
  for (const r of releves) {
    const tous = [r.debut, r.fin, ...(r.intermediaires ?? [])];
    if (tous.some((p) => !estDateValide(p.date) || !Number.isFinite(p.index))) {
      diagnostics.push({
        code: "RELEVES_INVALIDES",
        niveau: "erreur",
        message: `Logement ${r.logementId} : un relevé a une date ou un index invalide.`,
        logementId: r.logementId,
      });
      continue;
    }
    for (const [releve, borne] of [[r.debut, cycle.debut], [r.fin, cycle.fin]] as const) {
      const decalage = Math.abs(joursEntre(borne, releve.date));
      if (decalage > 0) {
        const tolere = decalage <= toleranceJoursReleve;
        diagnostics.push({
          code: "RELEVE_DATE_DECALEE",
          niveau: tolere ? "info" : "avertissement",
          message: `Logement ${r.logementId} : relevé du ${releve.date}, à ${decalage} jour(s) de la date de la facture (${borne})${tolere ? ", toléré" : ""}.`,
          logementId: r.logementId,
        });
      }
    }
    const intermediaires = [...(r.intermediaires ?? [])].sort((a, b) => numeroJour(a.date) - numeroJour(b.date));
    if (intermediaires.some((p) => numeroJour(p.date) <= debutCycle || numeroJour(p.date) >= finCycle)) {
      diagnostics.push({
        code: "RELEVES_INVALIDES",
        niveau: "erreur",
        message: `Logement ${r.logementId} : un relevé intermédiaire est en dehors du cycle.`,
        logementId: r.logementId,
      });
      continue;
    }
    const points: Point[] = [
      { jour: debutCycle, index: dec(r.debut.index) },
      ...intermediaires.map((p) => ({ jour: numeroJour(p.date), index: dec(p.index) })),
      { jour: finCycle, index: dec(r.fin.index) },
    ];
    if (points.some((p, i) => i > 0 && p.index.lessThan(points[i - 1].index))) {
      diagnostics.push({
        code: "INDEX_EN_BAISSE",
        niveau: "erreur",
        message: `Logement ${r.logementId} : un index est inférieur au relevé précédent.`,
        logementId: r.logementId,
      });
      continue;
    }
    pointsParLogement.set(r.logementId, points);
  }

  // --- Occupations : découpage sur le cycle
  interface Segment {
    occupation: Occupation;
    debut: number;
    fin: number;
  }
  const segmentsParLogement = new Map<string, Segment[]>();
  for (const o of occupations) {
    if (!estDateValide(o.entree) || (o.sortie != null && !estDateValide(o.sortie))) {
      diagnostics.push({
        code: "OCCUPATION_INVALIDE",
        niveau: "erreur",
        message: `Occupant ${o.nom ?? o.occupantId} : date d'entrée ou de sortie invalide.`,
        occupantId: o.occupantId,
        logementId: o.logementId,
      });
      continue;
    }
    const entree = numeroJour(o.entree);
    const sortie = o.sortie != null ? numeroJour(o.sortie) : Infinity;
    if (sortie <= entree) {
      diagnostics.push({
        code: "OCCUPATION_INVALIDE",
        niveau: "erreur",
        message: `Occupant ${o.nom ?? o.occupantId} : la sortie doit être après l'entrée.`,
        occupantId: o.occupantId,
        logementId: o.logementId,
      });
      continue;
    }
    const debut = Math.max(entree, debutCycle);
    const fin = Math.min(sortie, finCycle);
    if (fin <= debut) continue; // pas présent pendant ce cycle
    const liste = segmentsParLogement.get(o.logementId) ?? [];
    liste.push({ occupation: o, debut, fin });
    segmentsParLogement.set(o.logementId, liste);
  }

  for (const [logementId, segments] of segmentsParLogement) {
    segments.sort((a, b) => a.debut - b.debut);
    if (segments.some((s, i) => i > 0 && s.debut < segments[i - 1].fin)) {
      diagnostics.push({
        code: "OCCUPATIONS_CHEVAUCHEES",
        niveau: "erreur",
        message: `Logement ${logementId} : deux occupations se chevauchent.`,
        logementId,
      });
    }
    if (!releves.some((r) => r.logementId === logementId)) {
      diagnostics.push({
        code: "RELEVES_MANQUANTS",
        niveau: "erreur",
        message: `Logement ${logementId} : occupé pendant le cycle mais sans relevé.`,
        logementId,
      });
    }
  }

  if (diagnostics.some((d) => d.niveau === "erreur")) {
    return { participants: [], nonAttribueKwh: ZERO, diagnostics };
  }

  // --- Consommation de chaque segment, puis regroupement par occupant
  const parOccupant = new Map<string, ParticipantMesure>();
  let nonAttribueKwh = ZERO;

  for (const [logementId, points] of pointsParLogement) {
    const segments = segmentsParLogement.get(logementId) ?? [];
    const totalLogement = points[points.length - 1].index.minus(points[0].index);
    const attribues: Dec[] = [];

    for (const s of segments) {
      const a = indexAuJour(points, s.debut);
      const b = indexAuJour(points, s.fin);
      const kwh = b.index.minus(a.index);
      attribues.push(kwh);
      const estime = a.estime || b.estime;
      const o = s.occupation;
      if (estime) {
        diagnostics.push({
          code: "CONSOMMATION_ESTIMEE",
          niveau: "info",
          message: `${o.nom ?? o.occupantId} : pas de relevé au jour de l'arrivée ou du départ, consommation estimée au prorata des jours.`,
          occupantId: o.occupantId,
          logementId,
        });
      }
      const p = parOccupant.get(o.occupantId) ?? {
        occupantId: o.occupantId,
        nom: o.nom,
        logementIds: [],
        jours: 0,
        poids: ZERO,
        kwhMesures: ZERO,
        estime: false,
      };
      if (!p.logementIds.includes(logementId)) p.logementIds.push(logementId);
      p.jours += s.fin - s.debut;
      p.kwhMesures = p.kwhMesures.plus(kwh);
      p.estime ||= estime;
      parOccupant.set(o.occupantId, p);
    }

    const nonAttribue = totalLogement.minus(somme(attribues));
    if (nonAttribue.greaterThan(0)) {
      nonAttribueKwh = nonAttribueKwh.plus(nonAttribue);
      diagnostics.push({
        code: "CONSOMMATION_NON_ATTRIBUEE",
        niveau: "info",
        message: `Logement ${logementId} : ${nonAttribue.toString()} kWh relevés sans occupant, comptés dans l'écart.`,
        logementId,
      });
    }
  }

  const participants = [...parOccupant.values()].map((p) => ({
    ...p,
    poids: dec(p.jours).dividedBy(joursCycle),
  }));
  return { participants, nonAttribueKwh, diagnostics };
}

/** Index au jour `jour` : relevé exact s'il existe, sinon interpolation linéaire entre relevés. */
function indexAuJour(points: Point[], jour: number): { index: Dec; estime: boolean } {
  const exact = points.find((p) => p.jour === jour);
  if (exact) return { index: exact.index, estime: false };
  const apres = points.findIndex((p) => p.jour > jour);
  const p0 = points[apres - 1];
  const p1 = points[apres];
  const fraction = dec(jour - p0.jour).dividedBy(p1.jour - p0.jour);
  return { index: p0.index.plus(p1.index.minus(p0.index).times(fraction)), estime: true };
}
