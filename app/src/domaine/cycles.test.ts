import { describe, expect, it } from "vitest";
import { analyserBrouillon } from "./brouillon";
import { brouillonSuivant, figerCycle, peutEtreAnnule, resumer } from "./cycles";
import { empreinte } from "./empreinte";
import { brouillonExemple } from "./exemple";
import { PARAMETRES_SAISIS_PAR_DEFAUT } from "./reglages";

describe("figerCycle", () => {
  const b = brouillonExemple();
  const resultat = analyserBrouillon(b).resultat!;

  it("fige le brouillon et le résultat, avec un résumé pour l'historique", () => {
    const c = figerCycle(b, resultat, new Date("2026-10-01T08:00:00Z"));
    expect(c.id.startsWith("2026-09-25-")).toBe(true);
    expect(resumer(c)).toEqual({
      id: c.id,
      version: 1,
      mois: "Septembre 2026",
      dateDebut: "2026-08-26",
      dateFin: "2026-09-25",
      kwh: 310,
      totalFacture: 200462.8,
      nbFoyers: 5,
      estimee: false,
      valideLe: "2026-10-01T08:00:00.000Z",
      valideLeMs: Date.parse("2026-10-01T08:00:00Z"),
      parametres: PARAMETRES_SAISIS_PAR_DEFAUT,
    });
    // Copie indépendante : modifier le brouillon ensuite ne change pas le cycle figé.
    b.facture.mois = "modifié";
    expect(c.brouillon.facture.mois).toBe("Septembre 2026");
  });

  it("refuse un cycle avec des erreurs", () => {
    expect(() => figerCycle(b, { ...resultat, ok: false })).toThrow();
  });

  it("seule la dernière validation, de moins de 30 jours, peut être annulée", () => {
    const c = figerCycle(brouillonExemple(), resultat, new Date("2026-10-01T08:00:00Z"));
    expect(peutEtreAnnule(c, c.id, new Date("2026-10-30T08:00:00Z"))).toBe(true);
    expect(peutEtreAnnule(c, c.id, new Date("2026-10-31T08:00:01Z"))).toBe(false);
    expect(peutEtreAnnule(c, "un-cycle-plus-recent", new Date("2026-10-02T08:00:00Z"))).toBe(false);
  });
});

describe("brouillonSuivant", () => {
  const b = brouillonExemple();
  const s = brouillonSuivant(b);

  it("commence où le cycle précédent s'arrête", () => {
    expect(s.facture).toMatchObject({ dateDebut: "2026-09-25", indexDebut: 30710, dateFin: null, indexFin: null, totalSaisi: null });
    expect(s.facture.puissanceKw).toBe(3.3);
    expect(s.releves.L04).toEqual({ indexDebut: 2354, dateFin: null, indexFin: null, intermediaires: {} });
    expect(Object.keys(s.releves)).toEqual(["L01", "L02", "L03", "L04", "L05"]);
  });

  it("garde les occupants encore présents et retire ceux qui sont partis", () => {
    expect(s.occupations.map((o) => o.occupantId)).toEqual(["A", "B", "C", "E"]);
  });

  it("n'est plus un exemple et repart sans acceptation forcée", () => {
    expect(s.exemple).toBe(false);
    expect(s.parametres).toEqual({ forcerFacture: false, forcerEcart: false });
  });
});

describe("empreinte", () => {
  it("ne dépend pas de l'ordre des clés", () => {
    expect(empreinte({ a: 1, b: { d: [1, 2], c: null } })).toBe(empreinte({ b: { c: null, d: [1, 2] }, a: 1 }));
    expect(empreinte({ a: 1 })).not.toBe(empreinte({ a: 2 }));
  });
});
