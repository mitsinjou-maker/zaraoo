import { describe, expect, it } from "vitest";
import type { Occupation, RelevesLogement } from "../src";
import { mesurerParticipants } from "../src/presence";
import { exempleSpecification } from "./donnees";

const cycle = { debut: "2026-08-26", fin: "2026-09-25" };

function mesurer(occupations: Occupation[], releves: RelevesLogement[], tolerance = 1) {
  const r = mesurerParticipants(cycle, occupations, releves, tolerance);
  return {
    ...r,
    participants: r.participants.map((p) => ({ ...p, poids: p.poids.toNumber(), kwh: p.kwhMesures.toNumber() })),
    nonAttribue: r.nonAttribueKwh.toNumber(),
    codes: r.diagnostics.map((d) => `${d.niveau}:${d.code}`),
  };
}

const releveL1: RelevesLogement = {
  logementId: "L1",
  debut: { date: "2026-08-26", index: 100 },
  fin: { date: "2026-09-25", index: 160 },
};

describe("mesurerParticipants", () => {
  it("exemple §6 : jours, poids et consommations", () => {
    const { occupations, releves } = exempleSpecification();
    const r = mesurer(occupations, releves);
    expect(r.participants.map((p) => [p.occupantId, p.jours, p.poids, p.kwh, p.estime])).toEqual([
      ["A", 30, 1, 20, false],
      ["B", 30, 1, 60, false],
      ["C", 30, 1, 160, false],
      ["D", 12, 0.4, 18, false],
      ["E", 18, 0.6, 36, false],
    ]);
    expect(r.nonAttribue).toBe(2); // logement L05 vide
    expect(r.codes).toEqual(["info:CONSOMMATION_NON_ATTRIBUEE"]);
  });

  it("sans relevé au déménagement, la consommation est partagée au prorata des jours et marquée estimée", () => {
    const r = mesurer(
      [
        { occupantId: "D", logementId: "L1", entree: "2025-01-01", sortie: "2026-09-05" },
        { occupantId: "E", logementId: "L1", entree: "2026-09-05" },
      ],
      [releveL1],
    );
    expect(r.participants.map((p) => [p.occupantId, p.jours, p.kwh, p.estime])).toEqual([
      ["D", 10, 20, true],
      ["E", 20, 40, true],
    ]);
    expect(r.codes.filter((c) => c.endsWith("CONSOMMATION_ESTIMEE"))).toHaveLength(2);
  });

  it("la consommation d'une période sans occupant n'est attribuée à personne", () => {
    const r = mesurer(
      [{ occupantId: "D", logementId: "L1", entree: "2025-01-01", sortie: "2026-09-05" }],
      [{ ...releveL1, intermediaires: [{ date: "2026-09-05", index: 130 }] }],
    );
    expect(r.participants.map((p) => [p.occupantId, p.jours, p.kwh])).toEqual([["D", 10, 30]]);
    expect(r.nonAttribue).toBe(30);
  });

  it("un occupant qui change de logement pendant le cycle reste un seul participant", () => {
    const r = mesurer(
      [
        { occupantId: "X", logementId: "L1", entree: "2025-01-01", sortie: "2026-09-10" },
        { occupantId: "X", logementId: "L2", entree: "2026-09-10" },
      ],
      [
        { ...releveL1, intermediaires: [{ date: "2026-09-10", index: 120 }] },
        {
          logementId: "L2",
          debut: { date: "2026-08-26", index: 0 },
          fin: { date: "2026-09-25", index: 15 },
          intermediaires: [{ date: "2026-09-10", index: 0 }],
        },
      ],
    );
    expect(r.participants).toHaveLength(1);
    expect(r.participants[0]).toMatchObject({ jours: 30, poids: 1, kwh: 35, estime: false, logementIds: ["L1", "L2"] });
    expect(r.nonAttribue).toBe(40); // L1 après le départ de X
  });

  it("un occupant arrivé après la fin du cycle n'est pas participant", () => {
    const r = mesurer([{ occupantId: "Z", logementId: "L1", entree: "2026-10-01" }], [releveL1]);
    expect(r.participants).toEqual([]);
    expect(r.nonAttribue).toBe(60);
  });

  it("signale un relevé décalé : toléré à 1 jour, avertissement au-delà", () => {
    const occ: Occupation[] = [{ occupantId: "A", logementId: "L1", entree: "2025-01-01" }];
    const unJour = mesurer(occ, [{ ...releveL1, fin: { date: "2026-09-26", index: 160 } }]);
    expect(unJour.codes).toEqual(["info:RELEVE_DATE_DECALEE"]);
    const troisJours = mesurer(occ, [{ ...releveL1, fin: { date: "2026-09-28", index: 160 } }]);
    expect(troisJours.codes).toEqual(["avertissement:RELEVE_DATE_DECALEE"]);
  });

  it("erreurs : index en baisse, occupations qui se chevauchent, relevés manquants", () => {
    expect(
      mesurer(
        [{ occupantId: "A", logementId: "L1", entree: "2025-01-01" }],
        [{ ...releveL1, fin: { date: "2026-09-25", index: 90 } }],
      ).codes,
    ).toContain("erreur:INDEX_EN_BAISSE");

    expect(
      mesurer(
        [
          { occupantId: "A", logementId: "L1", entree: "2025-01-01" },
          { occupantId: "B", logementId: "L1", entree: "2026-09-10" },
        ],
        [releveL1],
      ).codes,
    ).toContain("erreur:OCCUPATIONS_CHEVAUCHEES");

    expect(mesurer([{ occupantId: "A", logementId: "L9", entree: "2025-01-01" }], [releveL1]).codes).toContain(
      "erreur:RELEVES_MANQUANTS",
    );
  });
});
