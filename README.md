# Zaraoo

Zaraoo (nom de code du dépôt : `partage-jirama`) : répartition de la facture d'un compteur JIRAMA entre les foyers d'un bâtiment équipés de sous-compteurs.
Règles de calcul : [SPECIFICATION.md](SPECIFICATION.md).

## Organisation

| Dossier | Contenu |
|---|---|
| `packages/moteur` | Moteur de calcul en TypeScript, sans interface : facture, présence, écart, partage sériel, TVA, arrondis |
| `app` | Application web (React + Vite) |
| `maquette` | Maquettes HTML des écrans |
| `docs/FIREBASE.md` | Guide de mise en ligne avec Firebase |
| `firestore.rules` | Règles de sécurité Firestore (testées dans `app/tests-regles`) |
| `scripts` | Lancement des émulateurs Firebase, compte admin de test |

## Commandes

À lancer depuis ce dossier (Node.js 24 requis) :

```bash
npm install
```

```bash
npm test
```

```bash
npm run typecheck
```

```bash
npm run dev
```

Tests des règles de sécurité Firestore (émulateur, Java 21 requis) :

```bash
npm run test:regles
```

## Application

Écrans disponibles :
- **Saisie d'un cycle** (`app/src/pages/SaisieCycle.tsx`) — facture JIRAMA recalculée en direct, occupants (arrivées,
  départs), relevés des sous-compteurs et panneau de contrôle alimenté par le moteur.
- **Répartition** (`app/src/pages/RepartitionCycle.tsx`) — résumé de la facture, cartes par foyer ou tableau, filtres,
  tri, fiches PDF par foyer (`app/src/pdf/fiches.ts`, pdfmake chargé seulement au moment de l'export) et
  **validation du cycle** : il est figé et le cycle suivant est préparé (dates et index de départ, occupants restants).
- **Historique** (`app/src/pages/Historique.tsx`) — cycles validés, consultables en lecture seule ; export Excel (.csv)
  et sauvegarde complète (.json) ; la dernière validation peut être annulée dans les 30 jours.
- **Logements** (`app/src/pages/Logements.tsx`) — code, description, n° de sous-compteur, couleur ; ajout, modification,
  suppression d'un logement sans occupant.
- **Tarifs** (`app/src/pages/Tarifs.tsx`) — grilles tarifaires datées (tranches, frais fixes, taxes, TVA), la grille en
  vigueur à la date de la facture est proposée au cycle en cours ; règles de répartition (seuils d'écart, tolérances,
  arrondi).

Cas particuliers (§8 de la spécification) :
- **facture estimée** : le cycle est validé normalement ; le suivant est une régularisation qui repart du dernier index
  réel, et chaque foyer y est crédité de ce qu'il a payé (`app/src/domaine/regularisation.ts`) ;
- **remplacement d'un sous-compteur** : bouton « Compteur remplacé ? » dans les relevés ; les index du nouveau compteur
  sont ramenés sur l'échelle de l'ancien.

Données (`app/src/donnees`) :
- **avec Firebase** (`app/.env.local` rempli, voir [docs/FIREBASE.md](docs/FIREBASE.md)) : connexion de l'admin,
  brouillon, réglages et cycles dans Firestore, synchronisés entre ordinateur et téléphone ;
- **sans configuration** : mode local, tout reste dans le navigateur.

Au premier lancement, le cycle en cours est rempli avec les données fictives du §6 de la spécification ;
elles ne peuvent pas être validées.

## Moteur de calcul

Point d'entrée : `repartirCycle(entree)` dans `packages/moteur/src/repartition.ts`.
Il prend la facture, la grille tarifaire, les occupations et les relevés d'un cycle, et renvoie la part de chaque foyer avec les diagnostics (erreurs bloquantes, avertissements, informations).

Les tests (`packages/moteur/tests`) vérifient notamment :
- les factures réelles d'avril, mai et juin 2022, recalculées au centime ;
- l'exemple du §6 de la spécification, retrouvé au centime ;
- les propriétés du partage sériel (somme exacte, indépendance vis-à-vis des plus gros consommateurs, foyer à 0 kWh sans effet) ;
- déménagements avec ou sans relevé, logements vides, écart négatif, facture forcée, arrondis.
