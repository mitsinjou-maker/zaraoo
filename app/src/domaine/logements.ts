import { COULEURS_LOGEMENTS, nouvelId, relevesVides, type BrouillonCycle, type Logement, type OccupationSaisie } from "./brouillon";

/** Code proposé pour un nouveau logement : le numéro suivant le plus grand existant (L06 après L05). */
export function codeSuivant(b: BrouillonCycle): string {
  const numeros = b.logements.map((l) => Number(l.id.replace(/\D/g, "")) || 0);
  return `L${String(Math.max(0, ...numeros) + 1).padStart(2, "0")}`;
}

export function couleurSuivante(b: BrouillonCycle): string {
  return COULEURS_LOGEMENTS[b.logements.length % COULEURS_LOGEMENTS.length];
}

/** Message d'erreur si le code est vide ou déjà pris par un autre logement, sinon `null`. */
export function verifierCode(b: BrouillonCycle, code: string, ancien?: string): string | null {
  const c = code.trim();
  if (c === "") return "Le code est obligatoire.";
  if (c.length > 8) return "8 caractères au maximum.";
  if (b.logements.some((l) => l.id === c && l.id !== ancien)) return "Ce code est déjà utilisé.";
  return null;
}

export function ajouterLogement(b: BrouillonCycle, logement: Logement): void {
  b.logements.push(logement);
  b.releves[logement.id] = relevesVides();
}

/**
 * Modifie un logement. Si son code change, les occupations et les relevés du cycle en cours
 * suivent ; les cycles déjà validés gardent l'ancien code.
 */
export function modifierLogement(b: BrouillonCycle, ancien: string, nouveau: Logement): void {
  const i = b.logements.findIndex((l) => l.id === ancien);
  if (i < 0) return;
  b.logements[i] = nouveau;
  if (nouveau.id === ancien) return;
  for (const o of b.occupations) if (o.logementId === ancien) o.logementId = nouveau.id;
  b.releves[nouveau.id] = b.releves[ancien] ?? relevesVides();
  delete b.releves[ancien];
}

/** Occupations du cycle en cours qui empêchent de supprimer le logement. */
export function occupationsDuLogement(b: BrouillonCycle, id: string): OccupationSaisie[] {
  return b.occupations.filter((o) => o.logementId === id);
}

/** Supprime un logement sans occupation. Renvoie faux s'il est encore occupé. */
export function supprimerLogement(b: BrouillonCycle, id: string): boolean {
  if (occupationsDuLogement(b, id).length > 0) return false;
  b.logements = b.logements.filter((l) => l.id !== id);
  delete b.releves[id];
  return true;
}

export interface Arrivee {
  logementId: string;
  date: string;
  /** Foyer déjà dans le bâtiment qui change de logement… */
  occupantId?: string;
  /** …ou nom d'un nouveau foyer. */
  nom?: string;
}

/** Occupation en cours dans le logement à cette date (celle qui sera close par une arrivée). */
export function occupantEnPlace(b: BrouillonCycle, logementId: string, date: string): OccupationSaisie | undefined {
  return b.occupations.find((o) => o.logementId === logementId && o.entree < date && (o.sortie === null || o.sortie > date));
}

/** Occupation actuelle (sans date de sortie) d'un foyer. */
export function occupationActuelle(b: BrouillonCycle, occupantId: string): OccupationSaisie | undefined {
  return b.occupations.find((o) => o.occupantId === occupantId && o.sortie === null);
}

/** Message d'erreur si l'arrivée est impossible, sinon `null`. */
export function verifierArrivee(b: BrouillonCycle, a: Arrivee): string | null {
  if (!a.logementId || !a.date) return "Logement et date obligatoires.";
  if (a.occupantId) {
    const actuelle = occupationActuelle(b, a.occupantId);
    if (!actuelle) return "Ce foyer n'occupe plus aucun logement.";
    if (actuelle.logementId === a.logementId) return "Ce foyer occupe déjà ce logement.";
    if (a.date <= actuelle.entree) return "La date doit suivre son arrivée dans son logement actuel.";
    return null;
  }
  return (a.nom ?? "").trim() === "" ? "Le nom du foyer est obligatoire." : null;
}

/**
 * Enregistre une arrivée. L'occupant en place dans le logement part le même jour ; un foyer qui
 * change de logement quitte l'ancien le même jour et reste le même participant (mêmes droits).
 */
export function enregistrerArrivee(b: BrouillonCycle, a: Arrivee): void {
  const enPlace = occupantEnPlace(b, a.logementId, a.date);
  if (enPlace) enPlace.sortie = a.date;

  let occupantId = nouvelId();
  let nom = (a.nom ?? "").trim();
  if (a.occupantId) {
    const actuelle = occupationActuelle(b, a.occupantId);
    if (actuelle) {
      actuelle.sortie = a.date;
      nom = actuelle.nom;
    }
    occupantId = a.occupantId;
  }
  b.occupations.push({ id: nouvelId(), occupantId, nom, logementId: a.logementId, entree: a.date, sortie: null });
}
