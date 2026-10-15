# Mettre en ligne avec Firebase

Sans configuration, l'application fonctionne en **mode local** : les données restent dans le navigateur.
Ce guide la relie à Firebase pour avoir **un compte admin**, les **mêmes données sur l'ordinateur et le
téléphone**, et l'**historique des cycles validés** stocké en ligne.

Durée : environ 20 minutes. Offre gratuite « Spark » : largement suffisante (un admin, un cycle par mois).

---

## 1. Créer le projet

1. Ouvrez <https://console.firebase.google.com> avec votre compte Google.
2. **Créer un projet** → nom, par exemple `partage-jirama` → Google Analytics : inutile, vous pouvez le désactiver.

## 2. Déclarer l'application web

1. Dans le projet : **Paramètres du projet** (roue dentée) → **Vos applications** → icône **Web** (`</>`).
2. Surnom : `Partage JIRAMA`. Cochez **Configurer Firebase Hosting** si vous voulez publier l'application (étape 7).
3. Firebase affiche un bloc `firebaseConfig`. Dans le dossier `app`, copiez `.env.example` en **`.env.local`**
   et reportez-y chaque valeur :

   | Dans `firebaseConfig` | Dans `app/.env.local` |
   |---|---|
   | `apiKey` | `VITE_FIREBASE_API_KEY` |
   | `authDomain` | `VITE_FIREBASE_AUTH_DOMAIN` |
   | `projectId` | `VITE_FIREBASE_PROJECT_ID` |
   | `storageBucket` | `VITE_FIREBASE_STORAGE_BUCKET` |
   | `messagingSenderId` | `VITE_FIREBASE_MESSAGING_SENDER_ID` |
   | `appId` | `VITE_FIREBASE_APP_ID` |

   Ces valeurs identifient le projet ; elles ne sont pas secrètes (la sécurité vient des règles de l'étape 5).
   `.env.local` n'est pas versionné dans git.

## 3. Créer le compte admin

1. **Authentication** → **Commencer** → onglet **Méthode de connexion** → **Adresse e-mail/Mot de passe** → activer → Enregistrer.
2. Onglet **Utilisateurs** → **Ajouter un utilisateur** → votre adresse e-mail et un mot de passe solide.
   C'est le compte qui servira à se connecter à l'application.
3. Onglet **Paramètres** → **Actions des utilisateurs** → décochez **Autoriser la création de comptes**
   (personne d'autre ne pourra s'inscrire), puis Enregistrer.

## 4. Créer la base de données

1. **Firestore Database** → **Créer une base de données**.
2. Emplacement : le plus proche de Madagascar, par exemple `africa-south1 (Johannesburg)`.
   ⚠️ Il ne peut plus être changé ensuite.
3. Démarrer en **mode production**.

## 5. Publier les règles de sécurité

Les règles sont dans [`firestore.rules`](../firestore.rules) : chaque admin ne voit que ses données, et un
cycle validé ne peut **jamais** être modifié ni supprimé.

**Le plus simple** : Firestore Database → onglet **Règles** → remplacez tout le contenu par celui de
`firestore.rules` → **Publier**.

**Ou en ligne de commande**, depuis le dossier du projet :

```bash
npx firebase login
```

```bash
npx firebase use --add
```

```bash
npx firebase deploy --only firestore:rules
```

## 6. Lancer l'application

```bash
npm run dev
```

L'application affiche maintenant la page de connexion. Connectez-vous avec le compte de l'étape 3.
Au premier lancement, le cycle en cours contient les données d'exemple : utilisez
**Brouillon ▾ › Commencer un brouillon vierge** pour saisir votre premier vrai cycle.

## 7. Publier l'application (facultatif)

Pour l'ouvrir depuis le téléphone sans ordinateur allumé :

```bash
npm run deployer
```

L'application est alors disponible à l'adresse `https://<votre-projet>.web.app`
(les étapes `firebase login` et `firebase use --add` de l'étape 5 sont nécessaires une fois).

---

## Développer sans toucher au vrai projet : les émulateurs

Les émulateurs Firebase reproduisent Authentication et Firestore sur l'ordinateur (Java 21 requis).

```bash
npm run emulateurs
```

Dans un deuxième terminal, créez le compte admin de test (identifiants dans
[`scripts/compte-test-emulateur.mjs`](../scripts/compte-test-emulateur.mjs)) :

```bash
npm run compte-test
```

Puis lancez l'application reliée aux émulateurs :

```bash
npm run dev:emulateurs
```

Interface des émulateurs (données, comptes) : <http://127.0.0.1:4000>.
Les tests des règles de sécurité s'exécutent avec :

```bash
npm run test:regles
```

## Organisation des données

| Chemin Firestore | Contenu | Règle |
|---|---|---|
| `utilisateurs/{uid}/brouillon/courant` | cycle en cours de saisie | lecture et écriture par l'admin |
| `utilisateurs/{uid}/cycles/{id}` | cycle validé : brouillon et résultat figés | création seulement ; ni modification, ni suppression |
