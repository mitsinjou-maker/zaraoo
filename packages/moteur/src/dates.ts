import type { DateISO } from "./types";

const FORMAT = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Jour exprimé en nombre de jours depuis le 01/01/1970 (UTC, sans fuseau horaire). */
export function numeroJour(date: DateISO): number {
  const m = FORMAT.exec(date);
  if (!m) throw new Error(`Date invalide : « ${date} » (format attendu AAAA-MM-JJ)`);
  const [annee, mois, jour] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ms = Date.UTC(annee, mois - 1, jour);
  const verif = new Date(ms);
  if (verif.getUTCFullYear() !== annee || verif.getUTCMonth() !== mois - 1 || verif.getUTCDate() !== jour) {
    throw new Error(`Date invalide : « ${date} »`);
  }
  return ms / 86_400_000;
}

export function estDateValide(date: DateISO): boolean {
  try {
    numeroJour(date);
    return true;
  } catch {
    return false;
  }
}

/** Nombre de jours de `de` à `a` (négatif si `a` est avant `de`). */
export function joursEntre(de: DateISO, a: DateISO): number {
  return numeroJour(a) - numeroJour(de);
}
