import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { useCallback, useEffect, useState } from "react";
import { effacerDepotLocal, PREFIXE_ESSAI } from "../donnees/depot";
import { firebaseAuth, firebaseConfigure } from "../firebase/config";

export type Session =
  | { mode: "local" }
  | { mode: "essai"; quitter: (effacer: boolean) => void }
  | { mode: "firebase"; etat: "chargement" }
  | { mode: "firebase"; etat: "deconnecte" }
  | { mode: "firebase"; etat: "connecte"; utilisateur: User; deconnecter: () => Promise<void> };

/** Le mode essai est retenu dans ce navigateur, pour survivre à un rechargement de la page. */
const CLE_ESSAI = "zaraoo:mode-essai";

function essaiRetenu(): boolean {
  try {
    return localStorage.getItem(CLE_ESSAI) === "1";
  } catch {
    return false;
  }
}

function retenirEssai(actif: boolean) {
  try {
    if (actif) localStorage.setItem(CLE_ESSAI, "1");
    else localStorage.removeItem(CLE_ESSAI);
  } catch {
    // Stockage indisponible : l'essai dure jusqu'au rechargement de la page.
  }
}

type EtatFirebase = { etat: "chargement" } | { etat: "deconnecte" } | { etat: "connecte"; utilisateur: User };

/**
 * Session de l'utilisateur. Sans configuration Firebase, l'application fonctionne en mode local.
 * Avec Firebase : connexion par compte, ou mode essai sans compte (données dans ce navigateur, rien
 * n'est envoyé à Firebase). Un compte connecté l'emporte sur le mode essai.
 */
export function useSession(): { session: Session; commencerEssai: () => void } {
  const [firebase, setFirebase] = useState<EtatFirebase>({ etat: "chargement" });
  const [essai, setEssai] = useState(essaiRetenu);

  useEffect(() => {
    if (!firebaseConfigure) return;
    return onAuthStateChanged(firebaseAuth(), (utilisateur) =>
      setFirebase(utilisateur ? { etat: "connecte", utilisateur } : { etat: "deconnecte" }),
    );
  }, []);

  const commencerEssai = useCallback(() => {
    retenirEssai(true);
    setEssai(true);
  }, []);

  const quitter = useCallback((effacer: boolean) => {
    if (effacer) effacerDepotLocal(PREFIXE_ESSAI);
    retenirEssai(false);
    setEssai(false);
  }, []);

  let session: Session;
  if (!firebaseConfigure) session = { mode: "local" };
  else if (firebase.etat === "connecte") {
    session = { mode: "firebase", etat: "connecte", utilisateur: firebase.utilisateur, deconnecter: () => signOut(firebaseAuth()) };
  } else if (essai) session = { mode: "essai", quitter };
  else session = { mode: "firebase", etat: firebase.etat };

  return { session, commencerEssai };
}
