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
const donneesCycle = (id = "2026-09-25-abc", ok = true) => ({ id, version: 1, mois: "Septembre 2026", resultat: { ok } });

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

describe("cycles validés", () => {
  it("l'admin crée et relit un cycle validé", async () => {
    await assertSucceeds(cycle(admin()).set(donneesCycle()));
    await assertSucceeds(cycle(admin()).get());
  });

  it("un cycle validé est figé : ni modification, ni remplacement, ni suppression", async () => {
    await assertSucceeds(cycle(admin()).set(donneesCycle()));
    await assertFails(cycle(admin()).update({ mois: "Octobre 2026" }));
    await assertFails(cycle(admin()).set(donneesCycle()));
    await assertFails(cycle(admin()).delete());
  });

  it("refuse un cycle invalide ou mal identifié", async () => {
    await assertFails(cycle(admin()).set(donneesCycle("2026-09-25-abc", false)));
    await assertFails(cycle(admin(), "autre-id").set(donneesCycle("2026-09-25-abc")));
  });

  it("personne d'autre n'y a accès", async () => {
    await assertSucceeds(cycle(admin()).set(donneesCycle()));
    await assertFails(cycle(autre(), "2026-09-25-abc", "admin").get());
    await assertFails(cycle(anonyme(), "2026-09-25-abc", "admin").get());
    await assertFails(autre().collection("utilisateurs/admin/cycles").get());
  });
});
