/**
 * JSON avec les clés triées : deux objets de même contenu ont la même empreinte, quel que soit
 * l'ordre de leurs clés (Firestore renvoie les clés dans l'ordre alphabétique).
 */
export function empreinte(valeur: unknown): string {
  return JSON.stringify(valeur, (_cle, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );
}
