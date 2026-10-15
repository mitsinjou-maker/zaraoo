import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  browserLocalPersistence,
  connectAuthEmulator,
  indexedDBLocalPersistence,
  initializeAuth,
  type Auth,
} from "firebase/auth";

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

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

export function firebaseApp(): FirebaseApp {
  if (!firebaseConfigure) throw new Error("Firebase n'est pas configuré.");
  app ??= initializeApp(config);
  return app;
}

/**
 * Authentification par e-mail et mot de passe uniquement : sans le module des fenêtres de connexion
 * Google (popup / redirection), plus léger et sans iframe externe.
 */
export function firebaseAuth(): Auth {
  if (!auth) {
    auth = initializeAuth(firebaseApp(), { persistence: [indexedDBLocalPersistence, browserLocalPersistence] });
    if (avecEmulateurs) connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  }
  return auth;
}
