import { describe, expect, it } from "vitest";
import { analyserBrouillon, indexCorrige } from "./brouillon";
import { brouillonExemple } from "./exemple";

describe("remplacement d'un sous-compteur", () => {
  it("les index du nouveau compteur sont ramenés sur l'échelle de l'ancien", () => {
    const b = brouillonExemple();
    // L02 : ancien compteur relevé à 4 540 le 10/09, nouveau compteur posé à 0 ; 30 kWh ensuite.
    b.releves.L02.remplacement = { date: "2026-09-10", indexAncien: 4540, indexNouveau: 0 };
    b.releves.L02.indexFin = 30;
    expect(indexCorrige(b.releves.L02, "2026-09-25", 30)).toBe(4570);
    expect(indexCorrige(b.releves.L02, "2026-09-05", 4520)).toBe(4520);

    const r = analyserBrouillon(b).resultat!;
    expect(r.ok).toBe(true);
    // Même consommation que sans remplacement (4 510 → 4 570) : 60 kWh, mêmes montants.
    expect(r.participants.find((p) => p.occupantId === "B")!.kwhMesures).toBe(60);
    expect(r.totaux!.totalArrondi).toBe(analyserBrouillon(brouillonExemple()).resultat!.totaux!.totalArrondi);
  });

  it("un remplacement incomplet ou hors du cycle bloque le calcul", () => {
    const b = brouillonExemple();
    b.releves.L02.remplacement = { date: "2026-09-10", indexAncien: null, indexNouveau: 0 };
    const a = analyserBrouillon(b);
    expect(a.resultat).toBeNull();
    expect(a.manquants.map((m) => m.message)).toContain("L02 : compteur remplacé, date et index à saisir.");

    b.releves.L02.remplacement = { date: "2026-10-10", indexAncien: 4540, indexNouveau: 0 };
    expect(analyserBrouillon(b).manquants.map((m) => m.message)).toContain(
      "L02 : la date du remplacement doit être à l'intérieur du cycle.",
    );
  });

  it("sans déclaration de remplacement, un index qui retombe reste une erreur", () => {
    const b = brouillonExemple();
    b.releves.L02.indexFin = 30;
    const r = analyserBrouillon(b).resultat!;
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some((d) => d.code === "INDEX_EN_BAISSE")).toBe(true);
  });
});
