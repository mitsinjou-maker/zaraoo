import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import type { BrouillonCycle } from "../domaine/brouillon";
import { resumer, type CycleValide, type ResumeCycle } from "../domaine/cycles";
import type { Reglages } from "../domaine/reglages";
import type { Depot } from "./depot";

/**
 * Données de l'admin dans Firestore :
 * - `utilisateurs/{uid}/brouillon/courant` : le cycle en cours de saisie ;
 * - `utilisateurs/{uid}/reglages/courant` : grilles tarifaires et règles de répartition ;
 * - `utilisateurs/{uid}/cycles/{id}` : les cycles validés ; les règles de sécurité interdisent de les
 *   modifier, et de les supprimer plus de 30 jours après la validation ;
 * - `utilisateurs/{uid}/resumes/{id}` : résumé de chaque cycle validé (quelques centaines d'octets), pour
 *   afficher l'historique sans télécharger les cycles complets. Écrit et supprimé avec son cycle.
 */
export function depotFirebase(db: Firestore, uid: string): Depot {
  const refBrouillon = doc(db, "utilisateurs", uid, "brouillon", "courant");
  const refCycles = collection(db, "utilisateurs", uid, "cycles");
  const refResumes = collection(db, "utilisateurs", uid, "resumes");
  const refReglages = doc(db, "utilisateurs", uid, "reglages", "courant");

  /**
   * Cycles validés avant l'existence des résumés : s'il manque des résumés, on lit les cycles complets
   * une fois et on écrit les résumés manquants.
   */
  async function completerResumes(resumes: ResumeCycle[]): Promise<ResumeCycle[]> {
    const nombre = (await getCountFromServer(refCycles)).data().count;
    if (nombre === resumes.length) return resumes;
    const cycles = (await getDocs(refCycles)).docs.map((d) => d.data() as CycleValide);
    const connus = new Set(resumes.map((r) => r.id));
    const manquants = cycles.filter((c) => !connus.has(c.id)).map(resumer);
    const lot = writeBatch(db);
    for (const r of manquants) lot.set(doc(refResumes, r.id), r);
    await lot.commit();
    return cycles.map(resumer);
  }

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
      const resumes = (await getDocs(refResumes)).docs.map((d) => d.data() as ResumeCycle);
      return (await completerResumes(resumes)).sort((a, b) => b.dateFin.localeCompare(a.dateFin));
    },
    async dernierCycleId() {
      // Un seul document lu, quel que soit le nombre de cycles.
      const s = await getDocs(query(refCycles, orderBy("dateFin", "desc"), limit(1)));
      return s.docs[0]?.id;
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
      lot.set(doc(refResumes, cycle.id), resumer(cycle));
      lot.set(refBrouillon, suivant);
      await lot.commit();
    },
    async chargerReglages() {
      const s = await getDoc(refReglages);
      return s.exists() ? (s.data() as Reglages) : null;
    },
    async enregistrerReglages(reglages) {
      await setDoc(refReglages, reglages);
    },
    async annulerValidation(cycle) {
      // Les règles n'autorisent la suppression que dans les 30 jours qui suivent la validation.
      const lot = writeBatch(db);
      lot.delete(doc(refCycles, cycle.id));
      lot.delete(doc(refResumes, cycle.id));
      lot.set(refBrouillon, cycle.brouillon);
      await lot.commit();
    },
  };
}
