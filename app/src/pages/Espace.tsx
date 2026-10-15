import { DatesProvider } from "@mantine/dates";
import "@mantine/dates/styles.css";
import "dayjs/locale/fr";
import { useMemo } from "react";
import type { Compte } from "../composants/EnTete";
import { depotEssai, depotLocal } from "../donnees/depot";
import { depotFirebase } from "../donnees/depotFirebase";
import { baseFirestore } from "../firebase/firestore";
import { EspaceAdmin } from "./EspaceAdmin";

/**
 * Point d'entrée de l'espace admin, chargé à part (`React.lazy`) : la page de connexion n'a besoin
 * ni de Firestore, ni du moteur de calcul, ni des écrans de saisie.
 */
export default function Espace({ uid, essai = false, compte }: { uid: string | null; essai?: boolean; compte: Compte }) {
  // Firestore n'est initialisé que pour un compte connecté : le mode essai ne contacte jamais la base.
  const depot = useMemo(() => (uid ? depotFirebase(baseFirestore(), uid) : essai ? depotEssai : depotLocal), [uid, essai]);
  return (
    <DatesProvider settings={{ locale: "fr", firstDayOfWeek: 1 }}>
      <EspaceAdmin depot={depot} compte={compte} />
    </DatesProvider>
  );
}
