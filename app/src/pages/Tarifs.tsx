import { ActionIcon, Alert, Badge, Button, Checkbox, Group, SimpleGrid, Table, TextInput } from "@mantine/core";
import { useState } from "react";
import { ChampDate, ChampNombre } from "../composants/Champs";
import { EnTete, type Compte, type Rubrique } from "../composants/EnTete";
import type { BrouillonCycle, TarifSaisi } from "../domaine/brouillon";
import { empreinte } from "../domaine/empreinte";
import { dateFr, entier } from "../domaine/format";
import {
  grilleEnVigueur,
  grillesTriees,
  memeTarif,
  nouvelleGrille,
  tarifDeGrille,
  verifierParametres,
  verifierTarif,
  type GrilleDatee,
  type ParametresSaisis,
  type Reglages,
} from "../domaine/reglages";
import { COULEURS_TRANCHES } from "../domaine/repartition";

interface Props {
  reglages: Reglages;
  enregistrer: (r: Reglages) => Promise<void>;
  brouillon: BrouillonCycle;
  modifier: (m: (b: BrouillonCycle) => void) => void;
  naviguer: (r: Rubrique) => void;
  compte: Compte;
}

const aujourdhui = () => new Date().toISOString().slice(0, 10);

/** Erreurs d'une grille : tarif, nom et date d'effet (unique). */
function erreursGrille(g: GrilleDatee, toutes: GrilleDatee[]): string[] {
  const erreurs: string[] = [];
  if (g.nom.trim() === "") erreurs.push("Nom de la grille manquant.");
  if (!g.dateEffet) erreurs.push("Date d'entrée en vigueur manquante.");
  else if (toutes.some((x) => x.id !== g.id && x.dateEffet === g.dateEffet)) {
    erreurs.push("Une autre grille entre en vigueur le même jour.");
  }
  return [...erreurs, ...verifierTarif(g.tarif)];
}

/** Grilles tarifaires datées (spécification §3.1) et règles de répartition (§3.2). */
export function Tarifs({ reglages, enregistrer, brouillon, modifier, naviguer, compte }: Props) {
  const [edition, setEdition] = useState<Reglages>(() => structuredClone(reglages));
  const [choisie, setChoisie] = useState<string>(() => grilleEnVigueur(reglages, aujourdhui())?.id ?? reglages.grilles[0]?.id);
  const [envoi, setEnvoi] = useState<"en-cours" | "fait" | null>(null);
  const [erreurEnvoi, setErreurEnvoi] = useState<string | null>(null);

  const modifie = empreinte(edition) !== empreinte(reglages);
  const grille = edition.grilles.find((g) => g.id === choisie) ?? grillesTriees(edition)[0];
  const enVigueur = grilleEnVigueur(edition, aujourdhui());
  const erreursParGrille = new Map(edition.grilles.map((g) => [g.id, erreursGrille(g, edition.grilles)]));
  const erreurParametres = verifierParametres(edition.parametres);
  const valide = [...erreursParGrille.values()].every((e) => e.length === 0) && erreurParametres === null;

  const changer = (m: (r: Reglages) => void) => {
    setEdition((precedent) => {
      const suivant = structuredClone(precedent);
      m(suivant);
      return suivant;
    });
    setEnvoi(null);
  };
  const changerGrille = (m: (g: GrilleDatee) => void) =>
    changer((r) => {
      const g = r.grilles.find((x) => x.id === grille.id);
      if (g) m(g);
    });
  const changerTarif = (m: (t: TarifSaisi) => void) => changerGrille((g) => m(g.tarif));
  // Un champ vidé reste vide (null) pendant la saisie ; l'enregistrement est bloqué tant qu'il l'est.
  const changerParametre = (cle: keyof ParametresSaisis) => (v: number | null) =>
    changer((r) => void ((r.parametres as Record<keyof ParametresSaisis, number | null>)[cle] = v));

  const ajouterGrille = (base: GrilleDatee | undefined) => {
    const g = nouvelleGrille(base, aujourdhui());
    changer((r) => void r.grilles.push(g));
    setChoisie(g.id);
  };
  const supprimerGrille = () => {
    changer((r) => void (r.grilles = r.grilles.filter((g) => g.id !== grille.id)));
    setChoisie(grillesTriees(edition).find((g) => g.id !== grille.id)?.id ?? "");
  };

  const sauver = async () => {
    setEnvoi("en-cours");
    setErreurEnvoi(null);
    try {
      await enregistrer(edition);
      setEnvoi("fait");
    } catch (e) {
      setErreurEnvoi(e instanceof Error ? e.message : String(e));
      setEnvoi(null);
    }
  };

  const erreurs = erreursParGrille.get(grille.id) ?? [];
  const t = grille.tarif;
  const utiliseeParLeCycle = memeTarif(brouillon.tarif, t);
  const p = edition.parametres;

  return (
    <>
      <EnTete actif="tarifs" naviguer={naviguer} compte={compte} />
      <main className="pj-page">
        <div className="pj-fil pj-libelle">
          <span>Bâtiment</span>
          <span>/</span>
          <b>Tarifs et règles</b>
        </div>

        <div className="pj-bandeau" style={modifie ? undefined : { background: "var(--surface)", borderColor: "var(--trait)" }}>
          <p style={{ flex: 1, minWidth: 220, margin: 0 }}>
            {modifie
              ? "Modifications non enregistrées."
              : envoi === "fait"
                ? "✓ Enregistré."
                : "Les grilles et les règles servent au cycle en cours et aux suivants. Les cycles validés gardent celles de leur validation."}
          </p>
          {modifie && (
            <Button
              variant="default"
              onClick={() => {
                setEdition(structuredClone(reglages));
                if (!reglages.grilles.some((g) => g.id === choisie)) setChoisie(reglages.grilles[0]?.id);
              }}
            >
              Annuler
            </Button>
          )}
          <Button disabled={!modifie || !valide} loading={envoi === "en-cours"} onClick={sauver}>
            Enregistrer
          </Button>
        </div>
        {erreurEnvoi && (
          <Alert color="red" variant="light" radius={0} mb="md">
            Enregistrement impossible : {erreurEnvoi}
          </Alert>
        )}

        <div className="pj-titre-section pj-libelle">
          <span>
            01 / <b>Grilles tarifaires</b>
          </span>
          <Button onClick={() => ajouterGrille(grille)}>+ Nouvelle grille</Button>
        </div>
        <p className="pj-aide" style={{ marginTop: 0 }}>
          Quand la JIRAMA change ses prix, créez une grille avec sa date d'entrée en vigueur : chaque facture prend la grille
          en vigueur à la date de son nouvel index.
        </p>

        <div className="pj-grilles">
          <nav className="pj-liste-grilles" aria-label="Grilles">
            {grillesTriees(edition).map((g) => (
              <button key={g.id} type="button" data-actif={g.id === grille.id || undefined} onClick={() => setChoisie(g.id)}>
                <span>
                  <b>{g.nom || "Sans nom"}</b>
                </span>
                <span className="pj-gris" style={{ fontSize: 12.5 }}>
                  depuis le {dateFr(g.dateEffet)}
                </span>
                <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {g.id === enVigueur?.id && <Badge color="green">En vigueur</Badge>}
                  {(erreursParGrille.get(g.id)?.length ?? 0) > 0 && <Badge color="red">Incomplète</Badge>}
                </span>
              </button>
            ))}
          </nav>

          <div className="pj-cadre">
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" verticalSpacing="sm">
              <TextInput
                label="Nom de la grille"
                value={grille.nom}
                onChange={(e) => {
                  const v = e.currentTarget.value;
                  changerGrille((g) => void (g.nom = v));
                }}
              />
              <ChampDate
                label="En vigueur à partir du"
                valeur={grille.dateEffet}
                onValeur={(v) => changerGrille((g) => void (g.dateEffet = v ?? ""))}
              />
            </SimpleGrid>

            <div className="pj-sous-titre pj-libelle" style={{ marginTop: 20 }}>
              <span>Tranches</span>
              <Button
                size="xs"
                variant="default"
                onClick={() => changerTarif((x) => void x.tranches.push({ plafondKwh: null, prixKwh: null }))}
              >
                + Tranche
              </Button>
            </div>
            <div className="pj-tableau">
              <Table verticalSpacing={6} horizontalSpacing="sm" miw={420}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Tranche</Table.Th>
                    <Table.Th>Jusqu'à (kWh / mois)</Table.Th>
                    <Table.Th>Prix (Ar / kWh)</Table.Th>
                    <Table.Th w={40} />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {t.tranches.map((tr, i) => {
                    const derniere = i === t.tranches.length - 1;
                    const precedent = i === 0 ? 0 : t.tranches[i - 1].plafondKwh;
                    return (
                      <Table.Tr key={i}>
                        <Table.Td>
                          <span className="pj-carre" style={{ background: COULEURS_TRANCHES[i % 4] }} />
                          {i + 1}
                        </Table.Td>
                        <Table.Td>
                          {derniere ? (
                            <span className="pj-gris">
                              {precedent === null ? "au-delà du plafond précédent" : `au-delà de ${entier(precedent)} kWh`}
                            </span>
                          ) : (
                            <ChampNombre
                              size="xs"
                              valeur={tr.plafondKwh}
                              onValeur={(v) => changerTarif((x) => void (x.tranches[i].plafondKwh = v))}
                              styles={{ input: { textAlign: "right" } }}
                            />
                          )}
                        </Table.Td>
                        <Table.Td>
                          <ChampNombre
                            size="xs"
                            valeur={tr.prixKwh}
                            onValeur={(v) => changerTarif((x) => void (x.tranches[i].prixKwh = v))}
                            styles={{ input: { textAlign: "right" } }}
                          />
                        </Table.Td>
                        <Table.Td>
                          <ActionIcon
                            variant="subtle"
                            color="gray"
                            aria-label={`Retirer la tranche ${i + 1}`}
                            disabled={t.tranches.length === 1}
                            onClick={() => changerTarif((x) => void x.tranches.splice(i, 1))}
                          >
                            ✕
                          </ActionIcon>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </div>
            <p className="pj-aide" style={{ margin: "6px 0 0" }}>
              Plafonds pour un mois : ils sont multipliés par le coefficient de tranche imprimé sur la facture.
            </p>

            <div className="pj-sous-titre pj-libelle">
              <span>Frais fixes</span>
              <Button
                size="xs"
                variant="default"
                onClick={() => changerTarif((x) => void x.fraisFixes.push({ libelle: "", prixUnitaire: null, parKw: false }))}
              >
                + Frais
              </Button>
            </div>
            <div className="pj-tableau">
              <Table verticalSpacing={6} horizontalSpacing="sm" miw={460}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Libellé</Table.Th>
                    <Table.Th w={130}>Montant (Ar)</Table.Th>
                    <Table.Th>Calcul</Table.Th>
                    <Table.Th w={40} />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {t.fraisFixes.map((ff, i) => (
                    <Table.Tr key={i}>
                      <Table.Td>
                        <TextInput
                          size="xs"
                          value={ff.libelle}
                          onChange={(e) => {
                            const v = e.currentTarget.value;
                            changerTarif((x) => void (x.fraisFixes[i].libelle = v));
                          }}
                        />
                      </Table.Td>
                      <Table.Td>
                        <ChampNombre
                          size="xs"
                          valeur={ff.prixUnitaire}
                          onValeur={(v) => changerTarif((x) => void (x.fraisFixes[i].prixUnitaire = v))}
                          styles={{ input: { textAlign: "right" } }}
                        />
                      </Table.Td>
                      <Table.Td>
                        <Checkbox
                          size="xs"
                          label="× puissance (kW)"
                          checked={ff.parKw}
                          onChange={(e) => {
                            const v = e.currentTarget.checked;
                            changerTarif((x) => void (x.fraisFixes[i].parKw = v));
                          }}
                        />
                      </Table.Td>
                      <Table.Td>
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          aria-label={`Retirer ${ff.libelle || "ce frais"}`}
                          onClick={() => changerTarif((x) => void x.fraisFixes.splice(i, 1))}
                        >
                          ✕
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </div>
            <p className="pj-aide" style={{ margin: "6px 0 0" }}>
              Partagés selon les jours de présence de chaque foyer.
            </p>

            <div className="pj-sous-titre pj-libelle">
              <span>Taxes sur l'énergie</span>
              <Button size="xs" variant="default" onClick={() => changerTarif((x) => void x.taxes.push({ libelle: "", tauxPourcent: null }))}>
                + Taxe
              </Button>
            </div>
            <div className="pj-tableau">
              <Table verticalSpacing={6} horizontalSpacing="sm" miw={360}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Libellé</Table.Th>
                    <Table.Th w={130}>Taux</Table.Th>
                    <Table.Th w={40} />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {t.taxes.map((tx, i) => (
                    <Table.Tr key={i}>
                      <Table.Td>
                        <TextInput
                          size="xs"
                          value={tx.libelle}
                          onChange={(e) => {
                            const v = e.currentTarget.value;
                            changerTarif((x) => void (x.taxes[i].libelle = v));
                          }}
                        />
                      </Table.Td>
                      <Table.Td>
                        <ChampNombre
                          size="xs"
                          suffix=" %"
                          valeur={tx.tauxPourcent}
                          onValeur={(v) => changerTarif((x) => void (x.taxes[i].tauxPourcent = v))}
                          styles={{ input: { textAlign: "right" } }}
                        />
                      </Table.Td>
                      <Table.Td>
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          aria-label={`Retirer ${tx.libelle || "cette taxe"}`}
                          onClick={() => changerTarif((x) => void x.taxes.splice(i, 1))}
                        >
                          ✕
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </div>
            <p className="pj-aide" style={{ margin: "6px 0 0" }}>
              En pourcentage du montant de l'énergie ; chaque foyer les paie au prorata de son énergie.
            </p>

            <div className="pj-sous-titre pj-libelle">
              <span>TVA</span>
            </div>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" verticalSpacing="sm">
              <ChampNombre
                label="Taux de TVA"
                suffix=" %"
                valeur={t.tvaPourcent}
                onValeur={(v) => changerTarif((x) => void (x.tvaPourcent = v))}
                styles={{ input: { textAlign: "right" } }}
              />
              <ChampNombre
                label="Franchise (kWh exonérés)"
                description="Au prix de la 1re tranche ; partagée selon la présence."
                valeur={t.franchiseKwh}
                onValeur={(v) => changerTarif((x) => void ((x as { franchiseKwh: number | null }).franchiseKwh = v))}
                styles={{ input: { textAlign: "right" } }}
              />
            </SimpleGrid>

            {erreurs.length > 0 && (
              <Alert color="red" variant="light" radius={0} mt="md" title="À compléter avant d'enregistrer">
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {erreurs.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </Alert>
            )}

            <Group mt="lg" gap="sm">
              <Button variant="default" onClick={() => ajouterGrille(grille)}>
                Dupliquer
              </Button>
              <Button variant="default" color="red" disabled={edition.grilles.length <= 1} onClick={supprimerGrille}>
                Supprimer
              </Button>
              <span style={{ flex: 1 }} />
              {utiliseeParLeCycle ? (
                <Badge color="green">Prix du cycle en cours</Badge>
              ) : (
                <Button
                  disabled={modifie || erreurs.length > 0}
                  title={modifie ? "Enregistrez d'abord les modifications" : undefined}
                  onClick={() => modifier((b) => void (b.tarif = tarifDeGrille(grille)))}
                >
                  Appliquer au cycle en cours
                </Button>
              )}
            </Group>
          </div>
        </div>

        <div className="pj-titre-section pj-libelle" style={{ marginTop: 40 }}>
          <span>
            02 / <b>Règles de répartition</b>
          </span>
        </div>
        <div className="pj-cadre">
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md" verticalSpacing="md">
            <ChampNombre
              label="Écart positif maximal"
              description="Au-delà, il faut vérifier les relevés avant de valider."
              suffix=" %"
              valeur={p.seuilEcartPositifPourcent}
              onValeur={changerParametre("seuilEcartPositifPourcent")}
              styles={{ input: { textAlign: "right" } }}
            />
            <ChampNombre
              label="Écart négatif maximal"
              description="Sous-compteurs au-dessus du compteur JIRAMA."
              suffix=" %"
              valeur={p.seuilEcartNegatifPourcent}
              onValeur={changerParametre("seuilEcartNegatifPourcent")}
              styles={{ input: { textAlign: "right" } }}
            />
            <ChampNombre
              label="Tolérance sur les relevés"
              description="Écart accepté entre la date d'un relevé et celle de la facture."
              suffix=" j"
              decimalScale={0}
              valeur={p.toleranceJoursReleve}
              onValeur={changerParametre("toleranceJoursReleve")}
              styles={{ input: { textAlign: "right" } }}
            />
            <ChampNombre
              label="Tolérance sur la facture"
              description="Différence acceptée entre le total imprimé et le total recalculé."
              suffix=" Ar"
              valeur={p.toleranceFactureAr}
              onValeur={changerParametre("toleranceFactureAr")}
              styles={{ input: { textAlign: "right" } }}
            />
            <ChampNombre
              label="Arrondi des montants à payer"
              description="Au multiple de… (1 Ar, 50 Ar, 100 Ar…)."
              suffix=" Ar"
              valeur={p.pasArrondiAr}
              onValeur={changerParametre("pasArrondiAr")}
              styles={{ input: { textAlign: "right" } }}
            />
          </SimpleGrid>
          {erreurParametres && (
            <Alert color="red" variant="light" radius={0} mt="md">
              {erreurParametres}
            </Alert>
          )}
        </div>
      </main>
    </>
  );
}
