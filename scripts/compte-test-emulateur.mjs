// Crée le compte admin de test dans l'émulateur Firebase Auth (jamais dans un vrai projet).
// Usage : `npm run emulateurs` dans un terminal, puis `npm run compte-test` dans un autre.
const COMPTE = { email: "admin@partage-jirama.test", password: "essai-local-2026" };
const URL_EMULATEUR = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-cle";

const reponse = await fetch(URL_EMULATEUR, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ ...COMPTE, returnSecureToken: true }),
});
const corps = await reponse.json();
if (reponse.ok) {
  console.log(`Compte de test créé dans l'émulateur : ${COMPTE.email} / ${COMPTE.password}`);
} else if (corps?.error?.message === "EMAIL_EXISTS") {
  console.log(`Le compte de test existe déjà : ${COMPTE.email} / ${COMPTE.password}`);
} else {
  console.error("Création impossible (l'émulateur est-il lancé ?) :", corps?.error?.message ?? reponse.status);
  process.exit(1);
}
