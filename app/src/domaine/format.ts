const montantFr = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const kwhFr = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const entierFr = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const pourcentFr = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 2 });

/** 200 462,80 */
export const montant = (n: number) => montantFr.format(n);

/** Montant à payer : sans décimales s'il est rond (13 994), sinon au centime (11 410,73). */
export const aPayer = (n: number) => (Number.isInteger(Math.round(n * 100) / 100) ? entierFr.format(n) : montantFr.format(n));

/** 38,4 */
export const kwh = (n: number) => kwhFr.format(n);

const poidsFr = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

/** Poids de présence : 0,33 */
export const poids = (n: number) => poidsFr.format(n);

/** 30 400 */
export const entier = (n: number) => entierFr.format(n);

/** 0,052 → « 5,2 % » ; 0,0525 → « 5,25 % » */
export const pourcent = (fraction: number) => `${pourcentFr.format(fraction * 100)} %`;

/** 2026-09-25 → 25/09/2026 */
export const dateFr = (iso: string | null | undefined) => (iso ? iso.split("-").reverse().join("/") : "—");

/** « 25/09/2026 » ou « 2026-09-25 » saisis au clavier → 2026-09-25. */
export function lireDate(saisie: string): string | null {
  const fr = /^\s*(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\s*$/.exec(saisie);
  if (fr) return `${fr[3]}-${fr[2].padStart(2, "0")}-${fr[1].padStart(2, "0")}`;
  const iso = /^\s*(\d{4})-(\d{2})-(\d{2})\s*$/.exec(saisie);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
}
