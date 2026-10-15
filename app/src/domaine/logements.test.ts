import { describe, expect, it } from "vitest";
import { analyserBrouillon } from "./brouillon";
import { brouillonExemple } from "./exemple";
import {
  ajouterLogement,
  codeSuivant,
  enregistrerArrivee,
  modifierLogement,
  supprimerLogement,
  verifierArrivee,
  verifierCode,
} from "./logements";

describe("logements", () => {
  it("propose le code suivant et refuse un code déjà pris", () => {
    const b = brouillonExemple();
    expect(codeSuivant(b)).toBe("L06");
    expect(verifierCode(b, "L02")).toBe("Ce code est déjà utilisé.");
    expect(verifierCode(b, "L02", "L02")).toBeNull();
    expect(verifierCode(b, " ")).toBe("Le code est obligatoire.");
  });

  it("ajoute un logement avec des relevés vides", () => {
    const b = brouillonExemple();
    ajouterLogement(b, { id: "L06", couleur: "#000", nom: "Étage" });
    expect(b.logements.at(-1)).toEqual({ id: "L06", couleur: "#000", nom: "Étage" });
    expect(b.releves.L06).toEqual({ indexDebut: null, dateFin: null, indexFin: null, intermediaires: {} });
  });

  it("renommer un logement fait suivre occupations et relevés, sans changer le calcul", () => {
    const b = brouillonExemple();
    const avant = analyserBrouillon(b).resultat!.totaux!.totalArrondi;
    modifierLogement(b, "L04", { id: "A4", couleur: "#123456", nom: "Duplex", numeroCompteur: "SC-44" });
    expect(b.occupations.filter((o) => o.logementId === "A4").map((o) => o.nom)).toEqual(["Foyer D", "Foyer E"]);
    expect(b.releves.A4.intermediaires).toEqual({ "2026-09-07": 2318 });
    expect(b.releves.L04).toBeUndefined();
    const apres = analyserBrouillon(b).resultat!;
    expect(apres.ok).toBe(true);
    expect(apres.totaux!.totalArrondi).toBe(avant);
  });

  it("ne supprime qu'un logement sans occupation", () => {
    const b = brouillonExemple();
    expect(supprimerLogement(b, "L01")).toBe(false);
    expect(supprimerLogement(b, "L05")).toBe(true);
    expect(b.logements.map((l) => l.id)).toEqual(["L01", "L02", "L03", "L04"]);
    expect(b.releves.L05).toBeUndefined();
  });
});

describe("arrivées", () => {
  it("un nouveau foyer remplace l'occupant en place, qui part le même jour", () => {
    const b = brouillonExemple();
    enregistrerArrivee(b, { logementId: "L03", date: "2026-09-15", nom: "Foyer F" });
    expect(b.occupations.find((o) => o.nom === "Foyer C")!.sortie).toBe("2026-09-15");
    expect(b.occupations.at(-1)).toMatchObject({ nom: "Foyer F", logementId: "L03", entree: "2026-09-15", sortie: null });
  });

  it("un foyer qui change de logement reste le même participant", () => {
    const b = brouillonExemple();
    const erreur = verifierArrivee(b, { logementId: "L05", date: "2026-09-15", occupantId: "A" });
    expect(erreur).toBeNull();
    enregistrerArrivee(b, { logementId: "L05", date: "2026-09-15", occupantId: "A" });
    const occupationsA = b.occupations.filter((o) => o.occupantId === "A");
    expect(occupationsA.map((o) => [o.logementId, o.entree, o.sortie])).toEqual([
      ["L01", "2026-01-12", "2026-09-15"],
      ["L05", "2026-09-15", null],
    ]);
    // Relevés intermédiaires au 15/09 dans les deux logements, puis calcul : A reste un seul participant.
    b.releves.L01.intermediaires["2026-09-15"] = 1210;
    b.releves.L05.intermediaires["2026-09-15"] = 615;
    const r = analyserBrouillon(b).resultat!;
    const a = r.participants.find((p) => p.occupantId === "A")!;
    expect(r.participants).toHaveLength(5);
    expect(a.logementIds).toEqual(["L01", "L05"]);
    expect(a.jours).toBe(30);
    // 1 200 → 1 210 dans L01 jusqu'au 15/09, puis 615 → 617 dans L05.
    expect(a.kwhMesures).toBe(10 + 2);
    // L01 est vide après le départ de A : ses 10 derniers kWh vont dans l'écart.
    expect(r.ecart!.nonAttribueKwh).toBe(10);
  });

  it("refuse les arrivées impossibles", () => {
    const b = brouillonExemple();
    expect(verifierArrivee(b, { logementId: "L01", date: "2026-09-15", occupantId: "A" })).toBe("Ce foyer occupe déjà ce logement.");
    expect(verifierArrivee(b, { logementId: "L05", date: "2026-09-15", occupantId: "D" })).toBe(
      "Ce foyer n'occupe plus aucun logement.",
    );
    expect(verifierArrivee(b, { logementId: "L05", date: "2026-01-01", occupantId: "A" })).toBe(
      "La date doit suivre son arrivée dans son logement actuel.",
    );
    expect(verifierArrivee(b, { logementId: "L05", date: "2026-09-15", nom: "  " })).toBe("Le nom du foyer est obligatoire.");
  });
});
