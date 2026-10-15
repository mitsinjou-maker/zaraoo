import { Alert, Badge, Button, Group, Menu, Modal } from "@mantine/core";
import { useState } from "react";
import { EnTete, type Compte, type Rubrique } from "../composants/EnTete";
import { Etapes, type Etape } from "../composants/Etapes";
import { BarreMobile, PanneauControle } from "../composants/PanneauControle";
import { SectionFacture } from "../composants/SectionFacture";
import { SectionOccupants } from "../composants/SectionOccupants";
import { SectionReleves } from "../composants/SectionReleves";
import { brouillonVierge, type Analyse, type BrouillonCycle } from "../domaine/brouillon";
import { brouillonExemple } from "../domaine/exemple";
import type { Depot } from "../donnees/depot";

function etapes(analyse: Analyse): Etape[] {
  const res = analyse.resultat;
  const erreurFacture =
    analyse.manquants.some((m) => m.section === "facture") ||
    res?.diagnostics.some((d) => d.code === "FACTURE_INCOHERENTE" && d.niveau === "erreur");
  const participants = analyse.occupations.length > 0;
  const etatOccupants = !analyse.datesCompletes ? "neutre" : participants ? "ok" : "erreur";
  const erreurReleves =
    analyse.manquants.some((m) => m.section === "releves") ||
    res?.diagnostics.some((d) => d.logementId !== undefined && d.niveau === "erreur");
  const avertissements = res?.diagnostics.some((d) => d.niveau === "avertissement");

  return [
    { ancre: "facture", titre: "Facture", etat: erreurFacture ? "erreur" : "ok", texte: erreurFacture ? "!" : "✓" },
    {
      ancre: "occupants",
      titre: "Occupants",
      etat: etatOccupants,
      texte: etatOccupants === "neutre" ? "—" : participants ? "✓" : "!",
    },
    {
      ancre: "releves",
      titre: "Relevés",
      etat: erreurReleves ? "erreur" : "ok",
      texte: `${analyse.releves.saisis}/${analyse.releves.attendus}`,
    },
    {
      ancre: "controle",
      titre: "Contrôle",
      etat: !res ? "neutre" : !res.ok ? "erreur" : avertissements ? "alerte" : "ok",
      texte: !res ? "—" : !res.ok ? "✕" : avertissements ? "!" : "✓",
    },
  ];
}

interface Props {
  brouillon: BrouillonCycle;
  analyse: Analyse;
  modifier: (m: (b: BrouillonCycle) => void) => void;
  remplacer: (b: BrouillonCycle) => void;
  enregistreA: Date | null;
  erreurEnregistrement: string | null;
  lieu: Depot["lieu"];
  versRepartition: () => void;
  naviguer: (r: Rubrique) => void;
  compte: Compte;
}

export function SaisieCycle(props: Props) {
  const { brouillon, analyse, modifier, remplacer, enregistreA, erreurEnregistrement, lieu, versRepartition } = props;
  const [confirmation, setConfirmation] = useState<"exemple" | "vierge" | null>(null);

  return (
    <>
      <EnTete
        actif="saisie"
        naviguer={props.naviguer}
        compte={props.compte}
        droite={
          <Menu position="bottom-end">
            <Menu.Target>
              <Button variant="subtle" size="xs" color="dark">
                Brouillon ▾
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item onClick={() => setConfirmation("vierge")}>Commencer un brouillon vierge</Menu.Item>
              <Menu.Item onClick={() => setConfirmation("exemple")}>Recharger les données d'exemple</Menu.Item>
            </Menu.Dropdown>
          </Menu>
        }
      />

      <div className="pj-page">
        <div className="pj-fil pj-libelle">
          <span>Cycles</span>
          <span>/</span>
          <b>{brouillon.facture.mois || "Nouveau cycle"}</b>
          <span>/</span>
          <b>Saisie</b>
          <span className="pj-pastille">Brouillon</span>
          {brouillon.exemple && <Badge color="orange">Données d'exemple</Badge>}
          <span className="enregistre" style={{ marginLeft: "auto" }}>
            {enregistreA
              ? `Enregistré ${lieu === "firebase" ? "en ligne" : "dans ce navigateur"} · ${enregistreA.toLocaleTimeString("fr-FR")}`
              : ""}
          </span>
        </div>
        {erreurEnregistrement && (
          <Alert color="red" variant="light" radius={0} mb="md">
            {erreurEnregistrement} — la saisie reste dans cette page ; vérifiez la connexion Internet.
          </Alert>
        )}

        <Etapes etapes={etapes(analyse)} />

        <div className="pj-disposition">
          <div>
            <SectionFacture brouillon={brouillon} analyse={analyse} modifier={modifier} />
            <SectionOccupants brouillon={brouillon} analyse={analyse} modifier={modifier} />
            <SectionReleves brouillon={brouillon} analyse={analyse} modifier={modifier} />
          </div>
          <PanneauControle brouillon={brouillon} analyse={analyse} modifier={modifier} calculer={versRepartition} />
        </div>
      </div>

      <BarreMobile analyse={analyse} calculer={versRepartition} />

      <Modal
        opened={confirmation !== null}
        onClose={() => setConfirmation(null)}
        title={confirmation === "vierge" ? "Brouillon vierge" : "Données d'exemple"}
      >
        <p style={{ marginTop: 0 }}>
          La saisie en cours sera remplacée
          {confirmation === "vierge" ? ", y compris les logements, les occupants et les index de départ" : ""}. Les cycles
          validés ne sont pas touchés. Continuer ?
        </p>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setConfirmation(null)}>
            Annuler
          </Button>
          <Button
            color="red"
            onClick={() => {
              remplacer(confirmation === "vierge" ? brouillonVierge() : brouillonExemple());
              setConfirmation(null);
            }}
          >
            Remplacer
          </Button>
        </Group>
      </Modal>
    </>
  );
}
