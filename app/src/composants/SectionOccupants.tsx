import { ActionIcon, Alert, Badge, Button, Group, Menu, Modal, Select, Stack, Table, TextInput } from "@mantine/core";
import { useState } from "react";
import {
  COULEURS_LOGEMENTS,
  nouvelId,
  relevesVides,
  type Analyse,
  type BrouillonCycle,
  type OccupationSaisie,
  type StatutPresence,
} from "../domaine/brouillon";
import { dateFr, poids as formatPoids } from "../domaine/format";
import { ChampDate } from "./Champs";
import { PastilleLogement, Section } from "./Section";

interface Props {
  brouillon: BrouillonCycle;
  analyse: Analyse;
  modifier: (m: (b: BrouillonCycle) => void) => void;
}

const STATUTS: Record<StatutPresence, { texte: string; couleur: string }> = {
  present: { texte: "Présent", couleur: "blue" },
  entrant: { texte: "Entrant", couleur: "orange" },
  sortant: { texte: "Sortant", couleur: "orange" },
  passage: { texte: "Entrant et sortant", couleur: "orange" },
};

/** Occupation encore en cours à la date `date` dans le logement. */
function occupantEnPlace(b: BrouillonCycle, logementId: string, date: string): OccupationSaisie | undefined {
  return b.occupations.find((o) => o.logementId === logementId && o.entree < date && (o.sortie === null || o.sortie > date));
}

export function SectionOccupants({ brouillon, analyse, modifier }: Props) {
  const [modale, setModale] = useState<"arrivee" | "depart" | null>(null);
  const couleur = new Map(brouillon.logements.map((l) => [l.id, l.couleur]));
  const logementsOccupes = new Set(analyse.occupations.map((o) => o.occupation.logementId));
  const vides = brouillon.logements.filter((l) => !logementsOccupes.has(l.id));
  const participants = new Set(analyse.occupations.map((o) => o.occupation.occupantId)).size;
  const sommePoids = analyse.occupations.reduce((s, o) => s + o.poids, 0);

  const ajouterLogement = () =>
    modifier((b) => {
      const numeros = b.logements.map((l) => Number(l.id.replace(/\D/g, "")) || 0);
      const id = `L${String(Math.max(0, ...numeros) + 1).padStart(2, "0")}`;
      b.logements.push({ id, couleur: COULEURS_LOGEMENTS[b.logements.length % COULEURS_LOGEMENTS.length] });
      b.releves[id] = relevesVides();
    });

  return (
    <Section
      id="occupants"
      numero="02"
      titre="Occupants du cycle"
      actions={
        <Group gap={8}>
          <Button size="xs" variant="default" onClick={() => setModale("arrivee")}>
            + Arrivée
          </Button>
          <Button size="xs" variant="default" onClick={() => setModale("depart")}>
            − Départ
          </Button>
          <Button size="xs" variant="default" onClick={ajouterLogement}>
            + Logement
          </Button>
        </Group>
      }
    >
      <p className="pj-aide" style={{ margin: "0 0 12px" }}>
        Ne saisissez que les changements. Vacances : rien à faire, le foyer reste compté sur tout le cycle.
      </p>
      <div className="pj-tableau">
        <Table verticalSpacing={6} horizontalSpacing="sm" miw={520}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Lgt</Table.Th>
              <Table.Th>Occupant</Table.Th>
              <Table.Th>Entrée</Table.Th>
              <Table.Th>Sortie</Table.Th>
              <Table.Th className="r">Jours</Table.Th>
              <Table.Th className="r">Poids</Table.Th>
              <Table.Th className="pj-cacher-mobile">Statut</Table.Th>
              <Table.Th w={40} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {analyse.occupations.map(({ occupation: o, jours, poids, statut }) => (
              <Table.Tr key={o.id}>
                <Table.Td>
                  <PastilleLogement id={o.logementId} couleur={couleur.get(o.logementId) ?? "#ccc"} />
                </Table.Td>
                <Table.Td fw={700}>{o.nom}</Table.Td>
                <Table.Td className="pj-num" fw={statut === "entrant" || statut === "passage" ? 700 : 400}>
                  {dateFr(o.entree)}
                </Table.Td>
                <Table.Td className="pj-num" fw={o.sortie ? 700 : 400}>
                  {o.sortie ? dateFr(o.sortie) : <span className="pj-gris">—</span>}
                </Table.Td>
                <Table.Td className="r pj-num">{jours}</Table.Td>
                <Table.Td className="r pj-num">{formatPoids(poids)}</Table.Td>
                <Table.Td className="pj-cacher-mobile">
                  <Badge color={STATUTS[statut].couleur}>{STATUTS[statut].texte}</Badge>
                </Table.Td>
                <Table.Td>
                  <Menu position="bottom-end">
                    <Menu.Target>
                      <ActionIcon variant="default" aria-label={`Actions pour ${o.nom}`}>
                        …
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      {o.sortie && (
                        <Menu.Item
                          onClick={() => modifier((b) => void (b.occupations.find((x) => x.id === o.id)!.sortie = null))}
                        >
                          Annuler le départ
                        </Menu.Item>
                      )}
                      <Menu.Item
                        color="red"
                        onClick={() => modifier((b) => void (b.occupations = b.occupations.filter((x) => x.id !== o.id)))}
                      >
                        Supprimer cette occupation
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </Table.Td>
              </Table.Tr>
            ))}
            {vides.map((l) => (
              <Table.Tr key={l.id}>
                <Table.Td>
                  <PastilleLogement id={l.id} couleur={l.couleur} />
                </Table.Td>
                <Table.Td className="pj-gris" colSpan={3}>
                  Vide pendant ce cycle
                </Table.Td>
                <Table.Td className="r pj-num pj-gris">0</Table.Td>
                <Table.Td className="r pj-num pj-gris">0</Table.Td>
                <Table.Td className="pj-cacher-mobile">
                  <Badge color="gray">Vide</Badge>
                </Table.Td>
                <Table.Td />
              </Table.Tr>
            ))}
            <Table.Tr className="total">
              <Table.Td />
              <Table.Td colSpan={3}>
                {participants} participant{participants > 1 ? "s" : ""}
              </Table.Td>
              <Table.Td />
              <Table.Td className="r pj-num">{formatPoids(sommePoids)}</Table.Td>
              <Table.Td className="pj-cacher-mobile" />
              <Table.Td />
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </div>

      <ModaleArrivee ouverte={modale === "arrivee"} fermer={() => setModale(null)} brouillon={brouillon} modifier={modifier} />
      <ModaleDepart ouverte={modale === "depart"} fermer={() => setModale(null)} brouillon={brouillon} modifier={modifier} />
    </Section>
  );
}

interface PropsModale {
  ouverte: boolean;
  fermer: () => void;
  brouillon: BrouillonCycle;
  modifier: (m: (b: BrouillonCycle) => void) => void;
}

function ModaleArrivee({ ouverte, fermer, brouillon, modifier }: PropsModale) {
  const [nom, setNom] = useState("");
  const [logementId, setLogementId] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const enPlace = logementId && date ? occupantEnPlace(brouillon, logementId, date) : undefined;
  const complet = nom.trim() !== "" && logementId !== null && date !== null;

  const valider = () => {
    if (nom.trim() === "" || logementId === null || date === null) return;
    modifier((b) => {
      const precedent = occupantEnPlace(b, logementId, date);
      if (precedent) precedent.sortie = date;
      b.occupations.push({ id: nouvelId(), occupantId: nouvelId(), nom: nom.trim(), logementId, entree: date, sortie: null });
    });
    setNom("");
    setLogementId(null);
    setDate(null);
    fermer();
  };

  return (
    <Modal opened={ouverte} onClose={fermer} title="Enregistrer une arrivée">
      <Stack>
        <TextInput label="Nom du foyer" value={nom} onChange={(e) => setNom(e.currentTarget.value)} data-autofocus />
        <Select
          label="Logement"
          data={brouillon.logements.map((l) => l.id)}
          value={logementId}
          onChange={setLogementId}
          placeholder="Choisir"
          searchable
        />
        <ChampDate label="Date d'arrivée" valeur={date} onValeur={setDate} />
        {enPlace && (
          <Alert color="orange" variant="light" radius={0}>
            {enPlace.nom} occupe ce logement : son départ sera enregistré le {dateFr(date)}.
          </Alert>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={fermer}>
            Annuler
          </Button>
          <Button onClick={valider} disabled={!complet}>
            Enregistrer
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function ModaleDepart({ ouverte, fermer, brouillon, modifier }: PropsModale) {
  const [occupationId, setOccupationId] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const enCours = brouillon.occupations.filter((o) => o.sortie === null);
  const choisie = enCours.find((o) => o.id === occupationId);
  const dateInvalide = choisie && date !== null && date <= choisie.entree;
  const complet = choisie !== undefined && date !== null && !dateInvalide;

  const valider = () => {
    if (!complet || date === null) return;
    modifier((b) => void (b.occupations.find((o) => o.id === occupationId)!.sortie = date));
    setOccupationId(null);
    setDate(null);
    fermer();
  };

  return (
    <Modal opened={ouverte} onClose={fermer} title="Enregistrer un départ">
      <Stack>
        <Select
          label="Foyer qui part"
          data={enCours.map((o) => ({ value: o.id, label: `${o.nom} (${o.logementId})` }))}
          value={occupationId}
          onChange={setOccupationId}
          placeholder="Choisir"
          searchable
        />
        <ChampDate
          label="Date de départ"
          valeur={date}
          onValeur={setDate}
          error={dateInvalide ? "Le départ doit suivre l'arrivée" : undefined}
        />
        <p className="pj-aide" style={{ margin: 0 }}>
          Pensez à relever le sous-compteur le jour du départ : sinon sa consommation sera estimée au prorata des jours.
        </p>
        <Group justify="flex-end">
          <Button variant="default" onClick={fermer}>
            Annuler
          </Button>
          <Button onClick={valider} disabled={!complet}>
            Enregistrer
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
