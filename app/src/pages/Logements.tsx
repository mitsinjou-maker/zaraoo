import { ActionIcon, Alert, Button, ColorSwatch, Group, Menu, Modal, Stack, Table, TextInput } from "@mantine/core";
import { useState } from "react";
import { EnTete, type Compte, type Rubrique } from "../composants/EnTete";
import { PastilleLogement } from "../composants/Section";
import { COULEURS_LOGEMENTS, type BrouillonCycle, type Logement } from "../domaine/brouillon";
import {
  ajouterLogement,
  codeSuivant,
  couleurSuivante,
  modifierLogement,
  occupationsDuLogement,
  supprimerLogement,
  verifierCode,
} from "../domaine/logements";

interface Props {
  brouillon: BrouillonCycle;
  modifier: (m: (b: BrouillonCycle) => void) => void;
  naviguer: (r: Rubrique) => void;
  compte: Compte;
}

type Edition = { ancien: string | null; logement: Logement };

/** Logements du bâtiment et leurs sous-compteurs. */
export function Logements({ brouillon, modifier, naviguer, compte }: Props) {
  const [edition, setEdition] = useState<Edition | null>(null);
  const [aSupprimer, setASupprimer] = useState<Logement | null>(null);

  const occupantsActuels = (id: string) =>
    brouillon.occupations
      .filter((o) => o.logementId === id && o.sortie === null)
      .map((o) => o.nom)
      .join(", ");

  const nouveau = () =>
    setEdition({ ancien: null, logement: { id: codeSuivant(brouillon), couleur: couleurSuivante(brouillon), nom: "", numeroCompteur: "" } });

  return (
    <>
      <EnTete actif="logements" naviguer={naviguer} compte={compte} />
      <main className="pj-page">
        <div className="pj-fil pj-libelle">
          <span>Bâtiment</span>
          <span>/</span>
          <b>Logements</b>
        </div>

        <div className="pj-titre-section pj-libelle">
          <span>
            01 / <b>Logements et sous-compteurs</b>
          </span>
          <Button onClick={nouveau}>+ Ajouter un logement</Button>
        </div>
        <p className="pj-aide" style={{ marginTop: 0 }}>
          Les modifications s'appliquent au cycle en cours et aux suivants. Les cycles déjà validés gardent les logements
          tels qu'ils étaient.
        </p>

        {brouillon.logements.length === 0 ? (
          <p className="pj-aide">Aucun logement pour l'instant.</p>
        ) : (
          <div className="pj-tableau">
            <Table verticalSpacing={8} horizontalSpacing="sm" miw={560}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Code</Table.Th>
                  <Table.Th>Description</Table.Th>
                  <Table.Th>N° sous-compteur</Table.Th>
                  <Table.Th>Occupant actuel</Table.Th>
                  <Table.Th w={40} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {brouillon.logements.map((l) => (
                  <Table.Tr key={l.id}>
                    <Table.Td>
                      <PastilleLogement id={l.id} couleur={l.couleur} />
                    </Table.Td>
                    <Table.Td>{l.nom || <span className="pj-gris">—</span>}</Table.Td>
                    <Table.Td className="pj-num">{l.numeroCompteur || <span className="pj-gris">—</span>}</Table.Td>
                    <Table.Td>{occupantsActuels(l.id) || <span className="pj-gris">Vide</span>}</Table.Td>
                    <Table.Td>
                      <Menu position="bottom-end">
                        <Menu.Target>
                          <ActionIcon variant="default" aria-label={`Actions pour ${l.id}`}>
                            …
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item onClick={() => setEdition({ ancien: l.id, logement: { ...l } })}>Modifier</Menu.Item>
                          <Menu.Item color="red" onClick={() => setASupprimer(l)}>
                            Supprimer
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </div>
        )}
      </main>

      {edition && (
        <ModaleLogement
          brouillon={brouillon}
          edition={edition}
          fermer={() => setEdition(null)}
          enregistrer={(l) => {
            modifier((b) => (edition.ancien === null ? ajouterLogement(b, l) : modifierLogement(b, edition.ancien, l)));
            setEdition(null);
          }}
        />
      )}

      <Modal opened={aSupprimer !== null} onClose={() => setASupprimer(null)} title="Supprimer un logement">
        {aSupprimer &&
          (occupationsDuLogement(brouillon, aSupprimer.id).length > 0 ? (
            <>
              <Alert color="orange" variant="light" radius={0} mb="md">
                {aSupprimer.id} a des occupants dans le cycle en cours (
                {occupationsDuLogement(brouillon, aSupprimer.id)
                  .map((o) => o.nom)
                  .join(", ")}
                ). Supprimez d'abord ces occupations dans la section « Occupants » de la saisie.
              </Alert>
              <Group justify="flex-end">
                <Button variant="default" onClick={() => setASupprimer(null)}>
                  Fermer
                </Button>
              </Group>
            </>
          ) : (
            <>
              <p style={{ marginTop: 0 }}>
                Supprimer <b>{aSupprimer.id}</b> et ses relevés du cycle en cours ? Les cycles validés ne sont pas touchés.
              </p>
              <Group justify="flex-end">
                <Button variant="default" onClick={() => setASupprimer(null)}>
                  Annuler
                </Button>
                <Button
                  color="red"
                  onClick={() => {
                    modifier((b) => void supprimerLogement(b, aSupprimer.id));
                    setASupprimer(null);
                  }}
                >
                  Supprimer
                </Button>
              </Group>
            </>
          ))}
      </Modal>
    </>
  );
}

function ModaleLogement({
  brouillon,
  edition,
  fermer,
  enregistrer,
}: {
  brouillon: BrouillonCycle;
  edition: Edition;
  fermer: () => void;
  enregistrer: (l: Logement) => void;
}) {
  const [l, setL] = useState<Logement>(edition.logement);
  const erreurCode = verifierCode(brouillon, l.id, edition.ancien ?? undefined);
  const changement = edition.ancien !== null && edition.ancien !== l.id.trim();

  return (
    <Modal opened onClose={fermer} title={edition.ancien === null ? "Ajouter un logement" : `Modifier ${edition.ancien}`}>
      <Stack>
        <TextInput
          label="Code"
          description="Court : il apparaît sur les pastilles et les fiches (ex. L06)."
          value={l.id}
          onChange={(e) => {
            const v = e.currentTarget.value.toUpperCase();
            setL((x) => ({ ...x, id: v }));
          }}
          error={erreurCode}
          data-autofocus
        />
        <TextInput
          label="Description"
          placeholder="Ex. RDC gauche"
          value={l.nom ?? ""}
          onChange={(e) => {
            const v = e.currentTarget.value;
            setL((x) => ({ ...x, nom: v }));
          }}
        />
        <TextInput
          label="N° du sous-compteur"
          value={l.numeroCompteur ?? ""}
          onChange={(e) => {
            const v = e.currentTarget.value;
            setL((x) => ({ ...x, numeroCompteur: v }));
          }}
        />
        <div>
          <div className="pj-label-champ">Couleur</div>
          <Group gap={8}>
            {COULEURS_LOGEMENTS.map((c) => (
              <ColorSwatch
                key={c}
                component="button"
                type="button"
                color={c}
                radius={0}
                aria-label={`Couleur ${c}`}
                onClick={() => setL((x) => ({ ...x, couleur: c }))}
                style={{ cursor: "pointer", outline: l.couleur === c ? "2px solid var(--encre)" : "none", outlineOffset: 2 }}
              />
            ))}
          </Group>
        </div>
        {changement && !erreurCode && (
          <Alert color="blue" variant="light" radius={0}>
            Les occupations et relevés du cycle en cours passeront de {edition.ancien} à {l.id.trim()}.
          </Alert>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={fermer}>
            Annuler
          </Button>
          <Button
            disabled={erreurCode !== null}
            onClick={() => enregistrer({ ...l, id: l.id.trim(), nom: l.nom?.trim() || undefined, numeroCompteur: l.numeroCompteur?.trim() || undefined })}
          >
            Enregistrer
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
