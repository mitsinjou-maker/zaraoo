import { connectFirestoreEmulator, initializeFirestore, type Firestore } from "firebase/firestore";
import { avecEmulateurs, firebaseApp } from "./config";

let db: Firestore | null = null;

/** Base Firestore, chargée seulement après la connexion (module séparé de la page de connexion). */
export function baseFirestore(): Firestore {
  if (!db) {
    // Les champs facultatifs absents (undefined) ne sont pas acceptés par Firestore : on les ignore.
    db = initializeFirestore(firebaseApp(), { ignoreUndefinedProperties: true });
    if (avecEmulateurs) connectFirestoreEmulator(db, "127.0.0.1", 8080);
  }
  return db;
}
