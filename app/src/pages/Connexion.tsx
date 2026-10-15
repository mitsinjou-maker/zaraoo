import { Alert, Button, PasswordInput, Stack, TextInput } from "@mantine/core";
import { FirebaseError } from "firebase/app";
import { sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import { useState, type FormEvent } from "react";
import { firebase } from "../firebase/config";

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

/** Connexion de l'admin (compte créé dans la console Firebase, pas d'inscription depuis l'application). */
export function Connexion() {
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
      await signInWithEmailAndPassword(firebase().auth, email.trim(), motDePasse);
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
      await sendPasswordResetEmail(firebase().auth, email.trim());
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
          PARTAGE JIRAMA
        </div>
        <p className="pj-aide" style={{ margin: "0 0 20px" }}>
          Répartition de la facture JIRAMA entre les foyers. Accès réservé à l'administrateur.
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
      </form>
    </div>
  );
}
