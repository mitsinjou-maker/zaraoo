import type { ResultatParticipant } from "@partage-jirama/moteur";
import { relevesVides, type Analyse, type BrouillonCycle, type Logement } from "./brouillon";
import { dateFr } from "./format";

export const COULEURS_TRANCHES = ["var(--t1)", "var(--t2)", "var(--t3)", "var(--t4)"];

export type Categorie = "present" | "demenagement" | "vide";

export interface Etiquette {
  texte: string;
  couleur: "blue" | "orange" | "gray";
}

export interface FoyerAffiche {
  participant: ResultatParticipant;
  logements: Logement[];
  categorie: "present" | "demenagement";
  etiquettes: Etiquette[];
  /** Position du (premier) logement dans la liste des logements. */
  rang: number;
  entree: string;
}

export interface LogementVide {
  logement: Logement;
  /** kWh relevés au sous-compteur pendant le cycle (inclus dans l'écart). */
  kwhReleves: number | null;
}

export interface FoyersDuCycle {
  foyers: FoyerAffiche[];
  vides: LogementVide[];
}

/** Prépare l'affichage de la répartition : un foyer par participant, plus les logements vides. */
export function foyersDuCycle(brouillon: BrouillonCycle, analyse: Analyse): FoyersDuCycle {
  const participants = analyse.resultat?.participants ?? [];
  const rangLogement = new Map(brouillon.logements.map((l, i) => [l.id, i]));
  const logementParId = new Map(brouillon.logements.map((l) => [l.id, l]));

  const foyers = participants.map((p): FoyerAffiche => {
    const occupations = analyse.occupations.filter((o) => o.occupation.occupantId === p.occupantId);
    const etiquettes: Etiquette[] = [];
    for (const o of occupations) {
      if (o.statut === "entrant" || o.statut === "passage") {
        etiquettes.push({ texte: `Entrant ${dateFr(o.occupation.entree).slice(0, 5)}`, couleur: "gray" });
      }
      if ((o.statut === "sortant" || o.statut === "passage") && o.occupation.sortie) {
        etiquettes.push({ texte: `Sortant ${dateFr(o.occupation.sortie).slice(0, 5)}`, couleur: "gray" });
      }
    }
    const demenagement = etiquettes.length > 0 || p.logementIds.length > 1;
    etiquettes.unshift(demenagement ? { texte: "Déménagement", couleur: "orange" } : { texte: "Présent", couleur: "blue" });
    if (p.estime) etiquettes.push({ texte: "Estimé", couleur: "orange" });

    return {
      participant: p,
      logements: p.logementIds.map((id) => logementParId.get(id) ?? { id, couleur: "#cccccc" }),
      categorie: demenagement ? "demenagement" : "present",
      etiquettes,
      rang: rangLogement.get(p.logementIds[0]) ?? 0,
      entree: occupations[0]?.occupation.entree ?? "",
    };
  });

  const occupes = new Set(analyse.occupations.map((o) => o.occupation.logementId));
  const vides = brouillon.logements
    .filter((l) => !occupes.has(l.id))
    .map((l): LogementVide => {
      const r = brouillon.releves[l.id] ?? relevesVides();
      return {
        logement: l,
        kwhReleves: r.indexDebut !== null && r.indexFin !== null ? r.indexFin - r.indexDebut : null,
      };
    });

  return { foyers, vides };
}

export type Tri = "logement" | "montant" | "nom";

export function trierFoyers(foyers: FoyerAffiche[], tri: Tri): FoyerAffiche[] {
  const copie = [...foyers];
  if (tri === "montant") return copie.sort((a, b) => b.participant.totalArrondi - a.participant.totalArrondi);
  if (tri === "nom") {
    return copie.sort((a, b) => (a.participant.nom ?? "").localeCompare(b.participant.nom ?? "", "fr"));
  }
  return copie.sort((a, b) => a.rang - b.rang || a.entree.localeCompare(b.entree));
}
