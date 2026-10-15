import { Alert, Button, PasswordInput, Stack, TextInput } from "@mantine/core";
import { FirebaseError } from "firebase/app";
import { sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import { useState, type FormEvent } from "react";
import { firebaseAuth } from "../firebase/config";

function messageErreur(e: unknown): string {
  const code = e instanceof FirebaseError ? e.code : "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-email":
      return "Adresse e-mail ou mot de passe incorrect.";
    case "auth/too-many-requests":
      return "Trop de tentatives. Réessayez dans quelques minutes.";
    case "auth/network-request-failed":
      return "Pas de connexion Internet.";
    case "auth/missing-email":
      return "Saisissez d'abord votre adresse e-mail.";
    default:
      return e instanceof Error ? e.message : "Erreur inconnue.";
  }
}

/**
 * Connexion (comptes créés dans la console Firebase, pas d'inscription depuis l'application), ou
 * essai sans compte : les données restent alors dans le navigateur.
 */
export function Connexion({ commencerEssai }: { commencerEssai: () => void }) {
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const seConnecter = async (e: FormEvent) => {
    e.preventDefault();
    setEnCours(true);
    setErreur(null);
    setInfo(null);
    try {
      await signInWithEmailAndPassword(firebaseAuth(), email.trim(), motDePasse);
    } catch (err) {
      setErreur(messageErreur(err));
    } finally {
      setEnCours(false);
    }
  };

  const reinitialiser = async () => {
    setErreur(null);
    setInfo(null);
    try {
      await sendPasswordResetEmail(firebaseAuth(), email.trim());
      setInfo("Si ce compte existe, un e-mail de réinitialisation vient d'être envoyé.");
    } catch (err) {
      setErreur(messageErreur(err));
    }
  };

  return (
    <div className="pj-connexion">
      <form className="pj-connexion-boite" onSubmit={seConnecter}>
        <div className="pj-marque" style={{ border: 0, padding: 0, marginBottom: 6 }}>
          <i aria-hidden />
          ZARAOO
        </div>
        <p className="pj-aide" style={{ margin: "0 0 20px" }}>
          Répartition de la facture JIRAMA entre les foyers d'un bâtiment. Connectez-vous avec le compte qui vous a été
          créé, ou essayez sans compte.
        </p>
        <Stack gap="sm">
          <TextInput
            label="Adresse e-mail"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            required
          />
          <PasswordInput
            label="Mot de passe"
            autoComplete="current-password"
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.currentTarget.value)}
            required
          />
          {erreur && (
            <Alert color="red" variant="light" radius={0}>
              {erreur}
            </Alert>
          )}
          {info && (
            <Alert color="blue" variant="light" radius={0}>
              {info}
            </Alert>
          )}
          <Button type="submit" loading={enCours} fullWidth mt={4}>
            Se connecter
          </Button>
          <Button variant="subtle" color="dark" size="xs" onClick={reinitialiser}>
            Mot de passe oublié ?
          </Button>
        </Stack>
        <div className="pj-essai">
          <Button variant="default" fullWidth onClick={commencerEssai}>
            Essayer sans compte
          </Button>
          <p className="pj-aide">
            Rien n'est envoyé en ligne : vos saisies restent dans ce navigateur, sur cet appareil. Exportez une sauvegarde
            (Historique) pour les conserver. Sur un ordinateur partagé, effacez-les en quittant l'essai.
          </p>
        </div>
      </form>
    </div>
  );
}
