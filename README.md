# Partage JIRAMA

Répartition de la facture d'un compteur JIRAMA entre les foyers d'un bâtiment équipés de sous-compteurs.
Règles de calcul : [SPECIFICATION.md](SPECIFICATION.md).

## Organisation

| Dossier | Contenu |
|---|---|
| `packages/moteur` | Moteur de calcul en TypeScript, sans interface : facture, présence, écart, partage sériel, TVA, arrondis |
| `app` | Application web (React + Vite) |
| `maquette` | Maquettes HTML des écrans |

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

## Application

Écrans disponibles :
- **Saisie d'un cycle** (`app/src/pages/SaisieCycle.tsx`) — facture JIRAMA recalculée en direct, occupants (arrivées,
  départs), relevés des sous-compteurs et panneau de contrôle alimenté par le moteur.
- **Répartition** (`app/src/pages/RepartitionCycle.tsx`) — résumé de la facture, cartes par foyer ou tableau, filtres,
  tri, et fiches PDF par foyer (`app/src/pdf/fiches.ts`, pdfmake chargé seulement au moment de l'export).

Pour l'instant, le brouillon est enregistré dans le navigateur (`app/src/donnees/depot.ts`) ; Firebase remplacera
cette couche sans toucher aux écrans. Au premier lancement, l'écran est rempli avec les données fictives du §6.

## Moteur de calcul

Point d'entrée : `repartirCycle(entree)` dans `packages/moteur/src/repartition.ts`.
Il prend la facture, la grille tarifaire, les occupations et les relevés d'un cycle, et renvoie la part de chaque foyer avec les diagnostics (erreurs bloquantes, avertissements, informations).

Les tests (`packages/moteur/tests`) vérifient notamment :
- les factures réelles d'avril, mai et juin 2022, recalculées au centime ;
- l'exemple du §6 de la spécification, retrouvé au centime ;
- les propriétés du partage sériel (somme exacte, indépendance vis-à-vis des plus gros consommateurs, foyer à 0 kWh sans effet) ;
- déménagements avec ou sans relevé, logements vides, écart négatif, facture forcée, arrondis.
