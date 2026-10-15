import { describe, expect, it } from "vitest";
import { analyserBrouillon } from "./brouillon";
import { figerCycle } from "./cycles";
import { brouillonExemple } from "./exemple";
import { sauvegarde, tableauCsv } from "./export";

const b = brouillonExemple();
const cycle = figerCycle(b, analyserBrouillon(b).resultat!, new Date("2026-10-01T08:00:00Z"));

describe("export", () => {
  it("produit un tableau Excel : une ligne par foyer, séparateur ; et virgule décimale", () => {
    const csv = tableauCsv([cycle]);
    expect(csv.startsWith("﻿Mois;Du;Au;")).toBe(true);
    const lignes = csv.trim().split("\r\n");
    expect(lignes).toHaveLength(1 + 5);
    expect(lignes[1]).toBe(
      "Septembre 2026;26/08/2026;25/09/2026;200462,80;Foyer A;L01;30;20,00;4,00;24,00;8160,00;428,40;4489,85;915,65;13994,00;non;01/10/2026;non;0,00;13994,00",
    );
    expect(lignes[4]).toContain(";Foyer D;L04;12;18,00;1,60;19,60;");
  });

  it("protège les cellules contenant un point-virgule", () => {
    const c = structuredClone(cycle);
    c.mois = "Sept; 2026";
    expect(tableauCsv([c]).split("\r\n")[1].startsWith('"Sept; 2026";')).toBe(true);
  });

  it("empêche Excel d'exécuter un nom saisi comme une formule", () => {
    const c = structuredClone(cycle);
    c.resultat.participants[0].nom = '=HYPERLINK("http://exemple.test")';
    const ligne = tableauCsv([c]).split("\r\n")[1];
    expect(ligne).toContain(`;"'=HYPERLINK(""http://exemple.test"")";`);
    // Les montants négatifs restent des nombres.
    expect(ligne).not.toContain("'-");
  });

  it("produit une sauvegarde complète, cycles du plus ancien au plus récent", () => {
    const autre = { ...structuredClone(cycle), id: "x", dateFin: "2026-08-25" };
    const s = sauvegarde([cycle, autre], b, new Date("2026-10-02T00:00:00Z"));
    expect(s.application).toBe("zaraoo");
    expect(s.cycles.map((c) => c.id)).toEqual(["x", cycle.id]);
    expect(s.brouillon).toBe(b);
  });
});
