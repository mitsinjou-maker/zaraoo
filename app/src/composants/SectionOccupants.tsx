import { ActionIcon, Alert, Badge, Button, Group, Menu, Modal, SegmentedControl, Select, Stack, Table, TextInput } from "@mantine/core";
import { useState } from "react";
import { type Analyse, type BrouillonCycle, type OccupationSaisie, type StatutPresence } from "../domaine/brouillon";
import { dateFr, poids as formatPoids } from "../domaine/format";
import {
  ajouterLogement,
  codeSuivant,
  couleurSuivante,
  enregistrerArrivee,
  occupantEnPlace,
  occupationActuelle,
  verifierArrivee,
} from "../domaine/logements";
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

export function SectionOccupants({ brouillon, analyse, modifier }: Props) {
  const [modale, setModale] = useState<"arrivee" | "depart" | null>(null);
  const couleur = new Map(brouillon.logements.map((l) => [l.id, l.couleur]));
  const logementsOccupes = new Set(analyse.occupations.map((o) => o.occupation.logementId));
  const debut = brouillon.facture.dateDebut;
  // Sans les dates de la facture, la présence ne peut pas être calculée : on affiche les occupants actuels.
  const lignes: { occupation: OccupationSaisie; jours: number | null; poids: number | null; statut: StatutPresence }[] =
    analyse.datesCompletes
      ? analyse.occupations
      : brouillon.occupations
          .filter((o) => o.sortie === null || debut === null || o.sortie > debut)
          .map((o) => ({ occupation: o, jours: null, poids: null, statut: "present" }));
  for (const o of lignes) logementsOccupes.add(o.occupation.logementId);
  const vides = brouillon.logements.filter((l) => !logementsOccupes.has(l.id));
  const participants = new Set(lignes.map((o) => o.occupation.occupantId)).size;
  const sommePoids = analyse.occupations.reduce((s, o) => s + o.poids, 0);

  // Ajout rapide ; le code, la description et le n° de compteur se modifient dans la page Logements.
  const ajouterRapidement = () => modifier((b) => ajouterLogement(b, { id: codeSuivant(b), couleur: couleurSuivante(b) }));

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
          <Button size="xs" variant="default" onClick={ajouterRapidement}>
            + Logement
          </Button>
        </Group>
      }
    >
      <p className="pj-aide" style={{ margin: "0 0 12px" }}>
        {analyse.datesCompletes
          ? "Ne saisissez que les changements. Vacances : rien à faire, le foyer reste compté sur tout le cycle."
          : "Occupants actuels. Les jours de présence seront calculés dès que les dates de la facture seront saisies (section 01)."}
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
            {lignes.map(({ occupation: o, jours, poids, statut }) => (
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
                <Table.Td className="r pj-num">{jours ?? "—"}</Table.Td>
                <Table.Td className="r pj-num">{poids === null ? "—" : formatPoids(poids)}</Table.Td>
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
              <Table.Td className="r pj-num">{analyse.datesCompletes ? formatPoids(sommePoids) : "—"}</Table.Td>
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
  const [type, setType] = useState<"nouveau" | "interne">("nouveau");
  const [nom, setNom] = useState("");
  const [occupantId, setOccupantId] = useState<string | null>(null);
  const [logementId, setLogementId] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);

  // Foyers qui occupent actuellement un logement du bâtiment (un seul choix par foyer).
  const foyersPresents = brouillon.occupations
    .filter((o) => o.sortie === null)
    .filter((o, i, liste) => liste.findIndex((x) => x.occupantId === o.occupantId) === i);
  const arrivee =
    type === "interne" ? { logementId: logementId ?? "", date: date ?? "", occupantId: occupantId ?? "" } : { logementId: logementId ?? "", date: date ?? "", nom };
  const complet = logementId !== null && date !== null && (type === "interne" ? occupantId !== null : nom.trim() !== "");
  const erreur = complet ? verifierArrivee(brouillon, arrivee) : null;
  const enPlace = logementId && date ? occupantEnPlace(brouillon, logementId, date) : undefined;
  const quitte = type === "interne" && occupantId ? occupationActuelle(brouillon, occupantId) : undefined;

  const reinitialiser = () => {
    setNom("");
    setOccupantId(null);
    setLogementId(null);
    setDate(null);
  };
  const valider = () => {
    if (!complet || erreur) return;
    modifier((b) => enregistrerArrivee(b, arrivee));
    reinitialiser();
    fermer();
  };

  return (
    <Modal opened={ouverte} onClose={fermer} title="Enregistrer une arrivée">
      <Stack>
        <SegmentedControl
          fullWidth
          radius={0}
          value={type}
          onChange={(v) => setType(v as "nouveau" | "interne")}
          data={[
            { value: "nouveau", label: "Nouveau foyer" },
            { value: "interne", label: "Foyer du bâtiment" },
          ]}
        />
        {type === "nouveau" ? (
          <TextInput label="Nom du foyer" value={nom} onChange={(e) => setNom(e.currentTarget.value)} data-autofocus />
        ) : (
          <Select
            label="Foyer qui change de logement"
            description="Il garde ses droits sur tout le cycle (un seul participant)."
            data={foyersPresents.map((o) => ({ value: o.occupantId, label: `${o.nom} (actuellement en ${o.logementId})` }))}
            value={occupantId}
            onChange={setOccupantId}
            placeholder="Choisir"
            searchable
          />
        )}
        <Select
          label={type === "interne" ? "Nouveau logement" : "Logement"}
          data={brouillon.logements.map((l) => ({ value: l.id, label: l.nom ? `${l.id} · ${l.nom}` : l.id }))}
          value={logementId}
          onChange={setLogementId}
          placeholder="Choisir"
          searchable
        />
        <ChampDate label="Date d'arrivée" valeur={date} onValeur={setDate} />
        {quitte && date && !erreur && (
          <Alert color="blue" variant="light" radius={0}>
            {quitte.nom} quittera {quitte.logementId} le {dateFr(date)}. Relevez les deux sous-compteurs ce jour-là.
          </Alert>
        )}
        {enPlace && !erreur && (
          <Alert color="orange" variant="light" radius={0}>
            {enPlace.nom} occupe ce logement : son départ sera enregistré le {dateFr(date)}.
          </Alert>
        )}
        {erreur && (
          <Alert color="red" variant="light" radius={0}>
            {erreur}
          </Alert>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={fermer}>
            Annuler
          </Button>
          <Button onClick={valider} disabled={!complet || erreur !== null}>
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
