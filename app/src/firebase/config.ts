import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, initializeFirestore, type Firestore } from "firebase/firestore";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/** Firebase est utilisé dès que sa configuration est présente (fichier .env.local) ; sinon, mode local. */
export const firebaseConfigure = Boolean(config.apiKey && config.projectId);

/** Vrai en développement avec les émulateurs Firebase (`npm run dev:emulateurs`). */
export const avecEmulateurs = import.meta.env.VITE_FIREBASE_EMULATEURS === "1";

let services: { auth: Auth; db: Firestore } | null = null;

export function firebase(): { auth: Auth; db: Firestore } {
  if (!firebaseConfigure) throw new Error("Firebase n'est pas configuré.");
  if (!services) {
    const app = initializeApp(config);
    const auth = getAuth(app);
    // Les champs facultatifs absents (undefined) ne sont pas acceptés par Firestore : on les ignore.
    const db = initializeFirestore(app, { ignoreUndefinedProperties: true });
    if (avecEmulateurs) {
      connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
      connectFirestoreEmulator(db, "127.0.0.1", 8080);
    }
    services = { auth, db };
  }
  return services;
}
