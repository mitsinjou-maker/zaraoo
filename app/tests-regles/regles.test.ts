// Tests des règles de sécurité Firestore : `npm run test:regles` (lance l'émulateur Firestore).
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-partage-jirama",
    firestore: {
      rules: readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});
afterAll(() => env.cleanup());
beforeEach(() => env.clearFirestore());

const admin = () => env.authenticatedContext("admin").firestore();
const autre = () => env.authenticatedContext("autre").firestore();
const anonyme = () => env.unauthenticatedContext().firestore();
const brouillon = (db: ReturnType<typeof admin>, uid = "admin") => db.doc(`utilisateurs/${uid}/brouillon/courant`);
const cycle = (db: ReturnType<typeof admin>, id = "2026-09-25-abc", uid = "admin") => db.doc(`utilisateurs/${uid}/cycles/${id}`);
const JOUR = 86_400_000;
const donneesCycle = (id = "2026-09-25-abc", ok = true, valideLeMs: number | string = Date.now()) => ({
  id,
  version: 1,
  mois: "Septembre 2026",
  dateFin: "2026-09-25",
  totalFacture: 200462.8,
  valideLeMs,
  resultat: { ok },
});
/** Résumé tel que l'application l'écrit : le cycle sans brouillon ni résultat. */
const resumeDe = (c: ReturnType<typeof donneesCycle>) => {
  const { resultat: _r, ...resume } = c;
  return resume;
};
const resume = (db: ReturnType<typeof admin>, id = "2026-09-25-abc", uid = "admin") => db.doc(`utilisateurs/${uid}/resumes/${id}`);

/** Place un cycle directement en base, sans passer par les règles (pour simuler un cycle ancien). */
async function placer(donnees: ReturnType<typeof donneesCycle>) {
  await env.withSecurityRulesDisabled((ctx) => ctx.firestore().doc(`utilisateurs/admin/cycles/${donnees.id}`).set(donnees));
}

describe("brouillon du cycle en cours", () => {
  it("l'admin lit et écrit le sien", async () => {
    await assertSucceeds(brouillon(admin()).set({ version: 1 }));
    await assertSucceeds(brouillon(admin()).get());
  });

  it("personne d'autre ne peut le lire ni l'écrire", async () => {
    await assertSucceeds(brouillon(admin()).set({ version: 1 }));
    await assertFails(brouillon(autre(), "admin").get());
    await assertFails(brouillon(autre(), "admin").set({ version: 1 }));
    await assertFails(brouillon(anonyme(), "admin").get());
  });

  it("seul le document « courant » est autorisé", async () => {
    await assertFails(admin().doc("utilisateurs/admin/brouillon/autre").set({ version: 1 }));
  });
});

describe("réglages (grilles et règles)", () => {
  it("l'admin lit et écrit les siens, personne d'autre", async () => {
    const reglages = (db: ReturnType<typeof admin>) => db.doc("utilisateurs/admin/reglages/courant");
    await assertSucceeds(reglages(admin()).set({ version: 1 }));
    await assertSucceeds(reglages(admin()).get());
    await assertFails(reglages(autre()).get());
    await assertFails(reglages(anonyme()).set({ version: 1 }));
    await assertFails(admin().doc("utilisateurs/admin/reglages/autre").set({ version: 1 }));
  });
});

describe("cycles validés", () => {
  it("l'admin crée et relit un cycle validé", async () => {
    await assertSucceeds(cycle(admin()).set(donneesCycle()));
    await assertSucceeds(cycle(admin()).get());
  });

  it("un cycle validé est figé : ni modification, ni remplacement", async () => {
    await assertSucceeds(cycle(admin()).set(donneesCycle()));
    await assertFails(cycle(admin()).update({ mois: "Octobre 2026" }));
    await assertFails(cycle(admin()).set(donneesCycle()));
  });

  it("la validation peut être annulée (suppression) dans les 30 jours", async () => {
    await placer(donneesCycle("recent", true, Date.now() - 29 * JOUR));
    await assertSucceeds(cycle(admin(), "recent").delete());
  });

  it("au-delà de 30 jours, ou pour un autre compte, la suppression est refusée", async () => {
    await placer(donneesCycle("ancien", true, Date.now() - 31 * JOUR));
    await assertFails(cycle(admin(), "ancien").delete());
    await placer(donneesCycle("recent", true, Date.now()));
    await assertFails(cycle(autre(), "recent", "admin").delete());
  });

  it("refuse un cycle invalide, mal identifié ou sans date de validation", async () => {
    await assertFails(cycle(admin()).set(donneesCycle("2026-09-25-abc", false)));
    await assertFails(cycle(admin(), "autre-id").set(donneesCycle("2026-09-25-abc")));
    await assertFails(cycle(admin()).set(donneesCycle("2026-09-25-abc", true, "hier")));
  });

  it("refuse une date de validation éloignée de l'heure du serveur", async () => {
    await assertFails(cycle(admin()).set(donneesCycle("2026-09-25-abc", true, Date.now() + 2 * 3_600_000)));
    await assertFails(cycle(admin()).set(donneesCycle("2026-09-25-abc", true, Date.now() - 31 * JOUR)));
    await assertSucceeds(cycle(admin()).set(donneesCycle("2026-09-25-abc", true, Date.now() - 10 * 60_000)));
  });

  it("le résumé est écrit avec son cycle, fidèle à celui-ci, et supprimé avec lui", async () => {
    const c = donneesCycle();
    const db = admin();
    const lot = db.batch();
    lot.set(cycle(db), c);
    lot.set(resume(db), resumeDe(c));
    await assertSucceeds(lot.commit());
    await assertSucceeds(resume(db).get());
    await assertFails(resume(autre(), c.id, "admin").get());
    // Jamais modifié, jamais supprimé tant que le cycle existe.
    await assertFails(resume(db).set({ ...resumeDe(c), mois: "autre" }));
    await assertFails(resume(db).delete());
    // Annulation : cycle et résumé supprimés ensemble.
    const annulation = db.batch();
    annulation.delete(cycle(db));
    annulation.delete(resume(db));
    await assertSucceeds(annulation.commit());
  });

  it("refuse un résumé sans cycle, infidèle ou contenant le cycle complet", async () => {
    const c = donneesCycle();
    await assertFails(resume(admin()).set(resumeDe(c))); // pas de cycle
    await placer(c);
    await assertFails(resume(admin()).set({ ...resumeDe(c), totalFacture: 1 }));
    await assertFails(resume(admin()).set(c)); // résultat inclus
    // Cycle validé avant l'existence des résumés : le résumé peut être ajouté après coup.
    await assertSucceeds(resume(admin()).set(resumeDe(c)));
  });

  it("personne d'autre n'y a accès", async () => {
    await assertSucceeds(cycle(admin()).set(donneesCycle()));
    await assertFails(cycle(autre(), "2026-09-25-abc", "admin").get());
    await assertFails(cycle(anonyme(), "2026-09-25-abc", "admin").get());
    await assertFails(autre().collection("utilisateurs/admin/cycles").get());
  });
});
