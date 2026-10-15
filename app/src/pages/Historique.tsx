import { Alert, Button, Loader, Table } from "@mantine/core";
import { useEffect, useState } from "react";
import { EnTete, type Compte, type Rubrique } from "../composants/EnTete";
import type { BrouillonCycle } from "../domaine/brouillon";
import type { ResumeCycle } from "../domaine/cycles";
import { aPayer, dateFr, entier } from "../domaine/format";
import type { Depot } from "../donnees/depot";

interface Props {
  depot: Depot;
  brouillon: BrouillonCycle;
  naviguer: (r: Rubrique) => void;
  ouvrir: (id: string) => void;
  compte: Compte;
}

/** Liste des cycles validés, du plus récent au plus ancien. */
export function Historique({ depot, brouillon, naviguer, ouvrir, compte }: Props) {
  const [cycles, setCycles] = useState<ResumeCycle[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let actif = true;
    depot
      .listerCycles()
      .then((c) => actif && setCycles(c))
      .catch((e: unknown) => actif && setErreur(e instanceof Error ? e.message : String(e)));
    return () => {
      actif = false;
    };
  }, [depot]);

  return (
    <>
      <EnTete actif="historique" naviguer={naviguer} compte={compte} />
      <main className="pj-page">
        <div className="pj-fil pj-libelle">
          <span>Cycles</span>
          <span>/</span>
          <b>Historique</b>
        </div>

        <div className="pj-bandeau">
          <span className="pj-pastille pj-libelle">En cours</span>
          <p>
            <b>{brouillon.facture.mois || "Nouveau cycle"}</b>
            {brouillon.facture.dateDebut ? ` · depuis le ${dateFr(brouillon.facture.dateDebut)}` : ""} — brouillon non validé.
          </p>
          <Button variant="default" onClick={() => naviguer("saisie")}>
            Continuer la saisie →
          </Button>
        </div>

        <div className="pj-titre-section pj-libelle">
          <span>
            01 / <b>Cycles validés</b>
          </span>
          <span>Figés : ils ne peuvent plus être modifiés</span>
        </div>

        {erreur && (
          <Alert color="red" variant="light" radius={0}>
            Impossible de charger l'historique : {erreur}
          </Alert>
        )}
        {!erreur && cycles === null && (
          <div className="pj-plein-ecran" style={{ minHeight: 160 }}>
            <Loader color="dark" size="sm" />
          </div>
        )}
        {cycles?.length === 0 && <p className="pj-aide">Aucun cycle validé pour l'instant.</p>}
        {cycles && cycles.length > 0 && (
          <div className="pj-tableau pj-historique">
            <Table verticalSpacing={8} horizontalSpacing="sm" miw={640} highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Mois</Table.Th>
                  <Table.Th>Période</Table.Th>
                  <Table.Th className="r">kWh</Table.Th>
                  <Table.Th className="r">Facture (Ar)</Table.Th>
                  <Table.Th className="r">Foyers</Table.Th>
                  <Table.Th>Validé le</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {cycles.map((c) => (
                  <Table.Tr key={c.id}>
                    <Table.Td className="mois">{c.mois}</Table.Td>
                    <Table.Td>
                      {dateFr(c.dateDebut)} → {dateFr(c.dateFin)}
                    </Table.Td>
                    <Table.Td className="r">{entier(c.kwh)}</Table.Td>
                    <Table.Td className="r">{aPayer(c.totalFacture)}</Table.Td>
                    <Table.Td className="r">{c.nbFoyers}</Table.Td>
                    <Table.Td>{new Date(c.valideLe).toLocaleDateString("fr-FR")}</Table.Td>
                    <Table.Td>
                      <Button size="xs" variant="default" onClick={() => ouvrir(c.id)}>
                        Ouvrir
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </div>
        )}
      </main>
    </>
  );
}
