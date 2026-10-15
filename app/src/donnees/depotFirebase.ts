import { collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, setDoc, writeBatch, type Firestore } from "firebase/firestore";
import type { BrouillonCycle } from "../domaine/brouillon";
import { resumer, type CycleValide } from "../domaine/cycles";
import type { Depot } from "./depot";

/**
 * Données de l'admin dans Firestore :
 * - `utilisateurs/{uid}/brouillon/courant` : le cycle en cours de saisie ;
 * - `utilisateurs/{uid}/cycles/{id}` : les cycles validés ; les règles de sécurité interdisent de les
 *   modifier, et de les supprimer plus de 30 jours après la validation.
 */
export function depotFirebase(db: Firestore, uid: string): Depot {
  const refBrouillon = doc(db, "utilisateurs", uid, "brouillon", "courant");
  const refCycles = collection(db, "utilisateurs", uid, "cycles");

  return {
    lieu: "firebase",
    async chargerBrouillon() {
      const s = await getDoc(refBrouillon);
      return s.exists() ? (s.data() as BrouillonCycle) : null;
    },
    async enregistrerBrouillon(brouillon) {
      await setDoc(refBrouillon, brouillon);
    },
    ecouterBrouillon(rappel) {
      return onSnapshot(refBrouillon, (s) => {
        // Nos propres écritures en attente ne sont pas des changements venus d'ailleurs.
        if (s.exists() && !s.metadata.hasPendingWrites) rappel(s.data() as BrouillonCycle);
      });
    },
    async listerCycles() {
      const s = await getDocs(query(refCycles, orderBy("dateFin", "desc")));
      return s.docs.map((d) => resumer(d.data() as CycleValide));
    },
    async chargerCycle(id) {
      const s = await getDoc(doc(refCycles, id));
      return s.exists() ? (s.data() as CycleValide) : null;
    },
    async chargerTousLesCycles() {
      const s = await getDocs(query(refCycles, orderBy("dateFin", "desc")));
      return s.docs.map((d) => d.data() as CycleValide);
    },
    async validerCycle(cycle, suivant) {
      const lot = writeBatch(db);
      lot.set(doc(refCycles, cycle.id), cycle);
      lot.set(refBrouillon, suivant);
      await lot.commit();
    },
    async annulerValidation(cycle) {
      // Les règles n'autorisent la suppression que dans les 30 jours qui suivent la validation.
      const lot = writeBatch(db);
      lot.delete(doc(refCycles, cycle.id));
      lot.set(refBrouillon, cycle.brouillon);
      await lot.commit();
    },
  };
}
