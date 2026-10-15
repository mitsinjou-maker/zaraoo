import Decimal from "decimal.js";

/** Décimal en précision étendue : aucune erreur d'arrondi binaire dans les montants. */
export const Dec = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
export type Dec = Decimal;

export const ZERO = new Dec(0);

export function dec(n: number | string | Decimal): Decimal {
  return new Dec(n);
}

/** Arrondi au centime, comme chaque ligne d'une facture JIRAMA. */
export function centimes(d: Decimal): Decimal {
  return d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function somme(valeurs: Decimal[]): Decimal {
  return valeurs.reduce((acc, v) => acc.plus(v), ZERO);
}

/** Nombre au format français pour les messages : 200 462,80. */
export function formatFr(d: Decimal, decimales: number): string {
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: decimales, maximumFractionDigits: decimales }).format(
    d.toDecimalPlaces(decimales).toNumber(),
  );
}

export function min(a: Decimal, b: Decimal): Decimal {
  return a.lessThan(b) ? a : b;
}

export function max(a: Decimal, b: Decimal): Decimal {
  return a.greaterThan(b) ? a : b;
}
