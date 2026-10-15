# Répartition de la facture JIRAMA — Spécification fonctionnelle

> Version 1 — 15/10/2026 — phase d'idéation validée, avant tout développement.

## 1. Contexte et objectif

Un bâtiment est alimenté par **un seul compteur JIRAMA**. Il abrite plusieurs foyers, chacun équipé d'un **sous-compteur**. À chaque facture JIRAMA (cycle mensuel), l'administrateur de l'outil collecte les relevés et répartit la facture entre les foyers.

L'outil doit :

1. répartir **l'énergie** de façon à ce qu'aucun foyer ne paie le passage aux tranches chères provoqué par de plus gros consommateurs que lui ;
2. gérer **l'écart** entre le compteur JIRAMA et la somme des sous-compteurs ;
3. répartir **les frais fixes, taxes et TVA** selon leur nature ;
4. accepter un **nombre de foyers variable** d'un cycle à l'autre (déménagements, logements vides) ;
5. garder **tous les tarifs et taux modifiables** ;
6. retomber **exactement** sur le montant de la facture.

### Décisions validées

| # | Décision |
|---|---|
| D1 | Énergie répartie par **partage sériel** (quotas égaux par tranche + redistribution des quotas inutilisés). |
| D2 | Quotas **égaux** entre foyers (pas de pondération par taille de foyer), proratisés uniquement par les **jours de présence**. |
| D3 | Les parties communes existent mais ne sont ni mesurables ni estimables : elles passent par **l'écart**. |
| D4 | **Pas** de gestion des paiements, avances ou impayés. |
| D5 | Le nombre de foyers **change** d'un cycle à l'autre. |
| D6 | Vacances : le foyer reste participant à **poids plein**. |
| D7 | Logement vide : sa part fixe est répartie entre les présents. Sa consommation éventuelle passe dans l'écart. |

### Hors périmètre (v1)

Paiements et impayés, facturation de l'eau, plusieurs bâtiments, envoi automatique des fiches.

---

## 2. La facture JIRAMA (modèle de calcul)

Modèle reconstitué au centime près à partir de factures réelles (avril et juin 2022, tarif 20 « Économique »). Les valeurs ci-dessous sont des **valeurs par défaut** : toutes sont des paramètres.

Notations : `X` = kWh facturés au compteur principal (nouvel index − ancien index).

| Bloc | Ligne | Règle | Paramètres (valeur 2022) |
|---|---|---|---|
| (1) | Énergie par tranche | tarification progressive sur `X` | T1 : 0–130 kWh à 340 Ar · T2 : 131–300 kWh à 560 Ar · T3 : au-delà à 764 Ar · T4 éventuelle |
| (1) | Redevance | montant fixe | 8 000 Ar |
| (1) | Prime fixe | prix × puissance souscrite | 3 018 Ar × 3,3 kW |
| (1) | Autres frais | montant fixe (souvent vide) | 0 |
| (2) | Taxe communale | % du montant énergie | 3,5 % |
| (2) | Surtaxe communale | % du montant énergie | 0,5 % |
| (2) | Fonds national de l'énergie durable | % du montant énergie | 1,25 % |
| (2) | Redevance assainissement | % ou fixe (vide en électricité) | 0 |
| TVA | TVA | taux × ((1) + (2) − franchise) | 20 % · franchise = 100 kWh × prix T1 = 34 000 Ar |
| | **TOTAL (3)** | (1) + (2) + TVA | |

Contrôle sur la facture d'avril 2022 (451 kWh) : 44 200 + 95 200 + 115 364 + 8 000 + 9 959,40 = 272 723,40 · taxes 13 375,11 · TVA 50 419,70 · **total 336 518,21** ✓.

### Notation de la fonction énergie

`E(x)` = coût hors taxes de `x` kWh selon la grille (somme, pour chaque tranche, des kWh de `x` qui tombent dans la tranche × prix de la tranche). Les seuils sont multipliés par le **coefficient de tranche** de la facture (1 sur toutes les factures observées).

### Hypothèses retenues (non vérifiables auprès de la JIRAMA)

Ces points ne peuvent pas être confirmés. Ils sont traités comme des **hypothèses paramétrables**. Le contrôle de facture (§5.1) sert de garde-fou : si une hypothèse est fausse, la facture recalculée ne correspondra pas à la facture saisie et l'outil le signalera.

- **Coefficient de tranche** : multiplie les seuils des tranches (valeur saisie depuis la facture, 1 par défaut). Juin 2022 : 27 jours, coefficient 1.
- **Franchise de TVA** : 100 kWh × prix T1, plafonnée à `X` × prix T1 si `X` < 100 kWh (cas improbable avec plusieurs foyers).
- **Factures estimées** (marquées « E ») et ligne « Déduction sur facture estimée antérieure (4) » : voir §8.

---

## 3. Paramètres

### 3.1 Grille tarifaire (versionnée)

Chaque grille a une **date d'effet**. À la saisie d'une facture, l'outil propose la grille en vigueur et l'admin la confirme ou la corrige d'après les prix imprimés sur la facture.

- Tranches : liste ordonnée de `(seuil haut en kWh, prix par kWh)` ; la dernière est sans seuil.
- Coefficient de tranche (défaut 1).
- Frais fixes : liste de `(libellé, montant)` ou `(libellé, prix unitaire × quantité)`.
- Taxes : liste de `(libellé, assiette, taux)`, assiette ∈ { montant énergie, montant fixe }.
- TVA : taux, franchise en kWh (défaut 100), prix de référence de la franchise (défaut prix T1).

Contrôle : si les prix ne sont pas croissants d'une tranche à l'autre, afficher un avertissement (la méthode reste juste, mais perd son sens).

### 3.2 Paramètres de répartition

| Paramètre | Défaut | Rôle |
|---|---|---|
| Seuil d'alerte écart positif | 10 % de `X` | au-delà : vérifier avant de valider |
| Seuil d'alerte écart négatif | 2 % de `X` | un écart négatif signale toujours une erreur de relevé ou de compteur |
| Tolérance relevé / date de la facture | 1 jour | avertissement si un sous-compteur est relevé à une autre date |
| Tolérance facture saisie / facture recalculée | 1 Ar | au-delà : alerte de cohérence (§5.1) |
| Pas d'arrondi des parts | 1 Ar | 0,01 Ar possible |

---

## 4. Données

| Entité | Contenu | Remarques |
|---|---|---|
| **Bâtiment** | nom, n° de compteur JIRAMA, référence client, puissance souscrite | un seul en v1 |
| **Logement** | nom, n° de sous-compteur, actif oui/non | stable dans le temps ; porte le sous-compteur |
| **Occupant** | nom, contact | c'est lui qui paie |
| **Occupation** | logement, occupant, date d'entrée, date de sortie (vide = toujours là) | pas de chevauchement dans un même logement |
| **Cycle** | date début et date fin (= dates des index de la facture), index principal début/fin, lignes de facture saisies, total (3), statut | statuts : brouillon → validé (figé) |
| **Relevé** | logement, date, index, photo (facultative), type : début / fin / déménagement | |
| **Résultat** | par participant : tout le détail du §5 | figé à la validation, avec copie des paramètres utilisés |

Règle : on saisit des **index**, jamais des consommations. La consommation est calculée.

---

## 5. Calcul d'un cycle

### 5.1 Étape 0 — Contrôle de la facture

1. `X` = index principal fin − index principal début.
2. Recalculer la facture (§2) avec les paramètres du cycle.
3. Comparer au total (3) saisi. Si l'écart dépasse la tolérance : alerte (paramètre faux, facture estimée, ligne oubliée). L'admin peut corriger les paramètres ou forcer.
4. **Le montant à répartir est toujours le total (3) saisi**, ligne par ligne.

### 5.2 Étape 1 — Participants et poids de présence

- `N` = nombre de jours du cycle (date fin − date début).
- Un **participant** est un occupant dont une occupation chevauche le cycle.
- `jours_i` = nombre de jours de chevauchement. Convention : le jour d'un déménagement compte pour l'occupant qui arrive.
- **Poids de présence** `w_i = jours_i / N` (entre 0 et 1). Les vacances ne réduisent pas le poids.
- Un occupant qui change de logement dans le bâtiment pendant le cycle est **un seul participant** : ses consommations et ses jours s'additionnent.
- `W` = somme des `w_i`.

### 5.3 Étape 2 — Consommation mesurée de chaque participant

- Logement occupé tout le cycle : `q_i` = index fin − index début.
- Déménagement avec relevé : chaque occupant reçoit la consommation entre ses propres index.
- Déménagement **sans** relevé : la consommation du logement est partagée au prorata des jours ; le résultat porte la mention **« estimé »**.
- Logement vide tout ou partie du cycle : la consommation de la période vide n'est attribuée à personne (elle tombe dans l'écart).

### 5.4 Étape 3 — Écart et consommation corrigée

`e = X − Σ q_i` (somme sur les participants).

- **Si `e ≥ 0`** (parties communes, pertes, consommation des logements vides) : réparti à parts égales selon la présence.
  `q'_i = q_i + e × w_i / W`
- **Si `e < 0`** (sous-compteurs au-dessus du compteur principal = erreur) : réduction proportionnelle.
  `q'_i = q_i × X / Σ q_i`

Dans les deux cas, `Σ q'_i = X`.

Affichages : écart en kWh et en % de `X`, part de chaque foyer, **historique de l'écart** (moyenne des 6 derniers cycles) pour repérer un niveau « normal ». Alerte si un seuil du §3.2 est dépassé.

### 5.5 Étape 4 — Énergie : partage sériel pondéré

Principe : on remplit les tranches comme un réservoir. Tous les participants « montent » ensemble au même rythme (proportionnel à leur poids). Celui qui a atteint sa consommation s'arrête. Le coût de chaque palier est partagé entre ceux qui montent encore, au prorata de leur poids.

Algorithme :

1. Pour chaque participant, `r_i = q'_i / w_i` (consommation par unité de présence).
2. Trier les participants par `r_i` croissant : `r_(1) ≤ r_(2) ≤ … ≤ r_(n)`. Poser `λ_0 = 0`, `x_0 = 0`.
3. Pour chaque palier `j = 1 … n` :
   - participants actifs = rangs `j … n` ; `S_j` = somme de leurs poids ;
   - `x_j = x_(j−1) + S_j × (r_(j) − r_(j−1))` ;
   - coût du palier `ΔE_j = E(x_j) − E(x_(j−1))` ;
   - chaque actif `k` paie `ΔE_j × w_k / S_j`.
4. On a `x_n = X` et la somme des paiements = `E(X)`.

**kWh par tranche pour chaque foyer** (pour la fiche) : les kWh du bâtiment entre `x_(j−1)` et `x_j` tombent dans une ou plusieurs tranches ; chaque actif en reçoit la fraction `w_k / S_j`. La somme des kWh d'un foyer sur toutes les tranches est égale à `q'_k`, et son montant énergie est égal à Σ (kWh de la tranche × prix de la tranche).

Propriétés garanties :
- ce que paie un foyer ne dépend **jamais** de la consommation de ceux qui consomment plus que lui (par jour de présence) ;
- un participant à 0 kWh ne modifie pas la répartition de l'énergie des autres ;
- si tout le monde est présent tout le cycle, chacun a droit au même quota dans chaque tranche, et les quotas non utilisés sont redistribués.

### 5.6 Étape 5 — Taxes proportionnelles à l'énergie

Pour chaque ligne de taxe dont l'assiette est l'énergie : part du foyer = montant de la ligne × `E_i / E(X)`.

### 5.7 Étape 6 — Frais fixes

Pour chaque ligne fixe (redevance, prime fixe, autres frais) : part du foyer = montant × `w_i / W`.
Les logements vides ne paient rien : leur part est absorbée par les présents.

### 5.8 Étape 7 — TVA

1. Assiette de chaque foyer : `A_i` = énergie + taxes + fixes du foyer.
2. **Franchise** (montant exonéré de TVA, 34 000 Ar par défaut) répartie selon la présence : `F_i = franchise × w_i / W`.
3. Plafond : un foyer ne peut pas recevoir plus de franchise que son assiette (`F_i ≤ A_i`). Le surplus est redistribué entre les autres selon la présence, en répétant jusqu'à ce que tout soit placé (même logique de « réservoir »).
4. `TVA_i = taux × (A_i − F_i)`.

### 5.9 Étape 8 — Total et arrondis

1. `Total_i = A_i + TVA_i` (calcul en pleine précision).
2. Arrondir chaque total au pas d'arrondi par la **méthode du plus fort reste**, pour que la somme des totaux arrondis soit **exactement** le total (3) de la facture.
3. Si le total recalculé diffère du total saisi (au-delà de la tolérance, après validation forcée par l'admin) : la différence est répartie au prorata des totaux et apparaît sur une ligne « ajustement ».

---

## 6. Exemple de validation (données fictives)

Cycle de 30 jours, tarifs 2022, puissance souscrite 3,3 kW. Compteur principal : **X = 310 kWh**.

| Logement | Situation | Participant | Jours | `w` | `q` (kWh) |
|---|---|---|---|---|---|
| L1 | présent | A | 30 | 1 | 20 |
| L2 | présent | B | 30 | 1 | 60 |
| L3 | présent | C | 30 | 1 | 160 |
| L4 | déménagement au 13e jour, avec relevé | D (sortant) | 12 | 0,4 | 18 |
| L4 | | E (entrant) | 18 | 0,6 | 36 |
| L5 | vide | — | — | — | (2 au sous-compteur → écart) |

`W` = 4 · `Σ q` = 294 · **écart `e` = 16 kWh** (5,2 %) → `q'` = `q` + 4 × `w`.

Facture recalculée : énergie 147 040 · fixes 17 959,40 · taxes 7 719,60 · TVA 27 743,80 · **total 200 462,80 Ar**.

Paliers du partage sériel (tri par `q'/w` : A 24, D 49, B 64, E 64, C 164) :

| Palier | kWh bâtiment | Poids actifs | Coût du palier |
|---|---|---|---|
| 1 | 0 → 96 | 4 | 32 640 |
| 2 | 96 → 171 | 3 | 34 520 |
| 3 | 171 → 210 | 2,6 | 21 840 |
| 4 | 210 → 210 (égalité B/E) | 2 | 0 |
| 5 | 210 → 310 | 1 | 58 040 |

Résultat :

| Foyer | `q'` | kWh T1 / T2 / T3 | Énergie | Taxes | Fixes | Franchise | TVA | **Total** | Ar/kWh |
|---|---|---|---|---|---|---|---|---|---|
| A | 24 | 24 / 0 / 0 | 8 160,00 | 428,40 | 4 489,85 | 8 500 | 915,65 | **13 993,90** | 583 |
| D | 19,6 | 14,13 / 5,47 / 0 | 7 866,67 | 413,00 | 1 795,94 | 3 400 | 1 335,12 | **11 410,73** | 582 |
| B | 64 | 35,33 / 28,67 / 0 | 28 066,67 | 1 473,50 | 4 489,85 | 8 500 | 5 106,00 | **39 136,02** | 612 |
| E | 38,4 | 21,2 / 17,2 / 0 | 16 840,00 | 884,10 | 2 693,91 | 5 100 | 3 063,60 | **23 481,61** | 612 |
| C | 164 | 35,33 / 118,67 / 10 | 86 106,67 | 4 520,60 | 4 489,85 | 8 500 | 17 323,42 | **112 440,54** | 686 |
| **Σ** | **310** | **130 / 170 / 10** | **147 040** | **7 719,60** | **17 959,40** | **34 000** | **27 743,80** | **200 462,80** | |

À observer : D et E ont des droits proportionnels à leur présence ; B et E ont le même prix moyen car ils consomment autant par jour de présence ; seul C, le plus gros consommateur, paie de la tranche 3.

---

## 7. Sorties

1. **Fiche par foyer** : jours de présence, index, kWh mesurés, part de l'écart, kWh par tranche, énergie, taxes, part fixe, franchise, TVA, total, prix moyen par kWh, mention « estimé » le cas échéant, et à titre indicatif **« si vous aviez votre propre compteur »** (facture recalculée avec `q_i` et la totalité des frais fixes).
2. **Tableau récapitulatif du cycle** : tous les foyers, contrôle Σ = facture.
3. **Rapport de contrôle** : facture saisie / recalculée, écart et historique, alertes.
4. **Historique** des cycles validés (figés, avec les paramètres utilisés).

---

## 8. Cas particuliers

| Cas | Traitement |
|---|---|
| Un seul participant | il paie toute la facture |
| Participant à 0 kWh (vacances) | énergie 0, sa part d'écart, sa part fixe ; TVA jamais négative (plafond de franchise §5.8) |
| Écart supérieur au seuil | alerte bloquante : l'admin vérifie ou force la validation |
| Écart négatif | réduction proportionnelle + alerte |
| Index qui diminue (sous-compteur remplacé ou remis à zéro) | l'admin saisit l'index final de l'ancien compteur et l'index initial du nouveau |
| Relevé de déménagement manquant | prorata des jours, mention « estimé » |
| Sous-compteur relevé à une autre date que la facture | avertissement (cause n° 1 d'écart) |
| Facture JIRAMA estimée (« E ») | on répartit la facture telle quelle (kWh estimés) et on marque le cycle « estimé ». La régularisation de la facture suivante (ligne (4)) est répartie comme une facture normale sur la consommation réelle. **Règle à confirmer** une fois une facture estimée observée. |
| Changement de tarif | une seule grille par facture, celle imprimée sur la facture |
| Aucun participant | impossible : erreur |

---

## 9. Déroulement d'un cycle (côté admin)

1. Recevoir la facture JIRAMA et saisir le cycle : dates et index du compteur principal, lignes et total.
2. Mettre à jour les occupations (arrivées, départs avec leur date).
3. Saisir les index des sous-compteurs, relevés **le même jour** que l'index JIRAMA (ou pendant la période d'auto-relevé indiquée sur le coupon), plus les relevés de déménagement.
4. Consulter le rapport de contrôle et traiter les alertes.
5. Valider : le cycle est figé.
6. Diffuser les fiches.

---

## 10. Contraintes d'usage (validées)

| Sujet | Décision |
|---|---|
| Utilisateurs | l'admin seul |
| Supports | ordinateur et téléphone, avec les mêmes données sur les deux |
| Connexion | Internet requis (pas de mode hors ligne exigé) |
| Diffusion | fiches exportables en **PDF** |
| Langue | français |
| Trajectoire | **application web d'abord**, puis application mobile et desktop |

---

## 11. Stack technique (validée)

| Élément | Choix |
|---|---|
| Langage | TypeScript |
| Interface | React + Vite (SPA), installable en PWA |
| Composants | Mantine (thème personnalisé, §12) |
| Moteur de calcul | module TypeScript séparé, sans dépendance à l'interface, calculs avec decimal.js |
| Tests | Vitest — l'exemple du §6 est le test de référence |
| Données et connexion | Firebase (Firestore + Authentication), derrière une couche d'accès aux données remplaçable |
| PDF | pdfmake, généré dans le navigateur, chargé à la demande |
| Hébergement | Firebase Hosting |
| Plus tard | Capacitor (Android / iOS), Tauri (desktop) |

---

## 12. Direction de design

Inspiration : style éditorial et technique (référence : capture du lanceur « ArtCraft »). On reprend le **langage visuel**, jamais le logo ni les illustrations.

| Principe | Application |
|---|---|
| Fond blanc cassé chaud, texte presque noir | ambiance « papier » |
| Bordures fines de 1 px, **aucun arrondi, aucune ombre** | cartes et tableaux en grille, bordures partagées |
| Deux polices | Inter (titres, texte) · JetBrains Mono (libellés en majuscules espacés, **tous les montants et kWh**) |
| Boutons | noirs pleins pour l'action principale ; carrés à bordure pour les actions secondaires (« … ») |
| Pastilles colorées numérotées | numéro du logement (L01, L02…) |
| Onglets à compteurs | Tous · Présents · Déménagements · Vides |
| Bascule Grille / Tableau | cartes par foyer ↔ tableau récapitulatif |
| Bandeau | alertes (écart, facture recalculée ≠ facture saisie) |
| Étiquettes à bordure colorée | ESTIMÉ · DÉMÉNAGEMENT · VACANCES |
| Sections numérotées | « 01 / FACTURE », « 02 / RELEVÉS », « 03 / RÉPARTITION » |
| Barre d'état en bas | état de la facture, écart, contrôle de la somme |
| Couleur par tranche | barre empilée T1 / T2 / T3 sur chaque carte de foyer |

Contraintes : mise en page en une colonne sur téléphone, onglets qui défilent horizontalement, libellés d'au moins 12 px, gris assez foncés pour un contraste suffisant.
