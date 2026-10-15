import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { useEffect, useState } from "react";
import { firebase, firebaseConfigure } from "../firebase/config";

export type Session =
  | { mode: "local" }
  | { mode: "firebase"; etat: "chargement" }
  | { mode: "firebase"; etat: "deconnecte" }
  | { mode: "firebase"; etat: "connecte"; utilisateur: User; deconnecter: () => Promise<void> };

/** Session de l'admin. Sans configuration Firebase, l'application fonctionne en mode local, sans compte. */
export function useSession(): Session {
  const [session, setSession] = useState<Session>(() =>
    firebaseConfigure ? { mode: "firebase", etat: "chargement" } : { mode: "local" },
  );

  useEffect(() => {
    if (!firebaseConfigure) return;
    const { auth } = firebase();
    return onAuthStateChanged(auth, (utilisateur) =>
      setSession(
        utilisateur
          ? { mode: "firebase", etat: "connecte", utilisateur, deconnecter: () => signOut(auth) }
          : { mode: "firebase", etat: "deconnecte" },
      ),
    );
  }, []);

  return session;
}
