import { Badge, Button, Group, Menu, Modal } from "@mantine/core";
import { useMemo, useState } from "react";
import { EnTete } from "../composants/EnTete";
import { Etapes, type Etape } from "../composants/Etapes";
import { ModaleApercu } from "../composants/ModaleApercu";
import { BarreMobile, PanneauControle } from "../composants/PanneauControle";
import { SectionFacture } from "../composants/SectionFacture";
import { SectionOccupants } from "../composants/SectionOccupants";
import { SectionReleves } from "../composants/SectionReleves";
import { analyserBrouillon, brouillonVierge, type Analyse } from "../domaine/brouillon";
import { brouillonExemple } from "../domaine/exemple";
import { depotLocal } from "../donnees/depot";
import { useBrouillon } from "../hooks/useBrouillon";

function etapes(analyse: Analyse): Etape[] {
  const res = analyse.resultat;
  const erreurFacture =
    analyse.manquants.some((m) => m.section === "facture") ||
    res?.diagnostics.some((d) => d.code === "FACTURE_INCOHERENTE" && d.niveau === "erreur");
  const participants = analyse.occupations.length > 0;
  const erreurReleves =
    analyse.manquants.some((m) => m.section === "releves") ||
    res?.diagnostics.some((d) => d.logementId !== undefined && d.niveau === "erreur");
  const avertissements = res?.diagnostics.some((d) => d.niveau === "avertissement");

  return [
    { ancre: "facture", titre: "Facture", etat: erreurFacture ? "erreur" : "ok", texte: erreurFacture ? "!" : "✓" },
    { ancre: "occupants", titre: "Occupants", etat: participants ? "ok" : "erreur", texte: participants ? "✓" : "!" },
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

export function SaisieCycle() {
  const { brouillon, modifier, remplacer, enregistreA } = useBrouillon(depotLocal);
  const analyse = useMemo(() => analyserBrouillon(brouillon), [brouillon]);
  const [apercu, setApercu] = useState(false);
  const [confirmation, setConfirmation] = useState<"exemple" | "vierge" | null>(null);
  const calculer = () => setApercu(true);

  return (
    <>
      <EnTete
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
            {enregistreA ? `Enregistré dans ce navigateur · ${enregistreA.toLocaleTimeString("fr-FR")}` : ""}
          </span>
        </div>

        <Etapes etapes={etapes(analyse)} />

        <div className="pj-disposition">
          <div>
            <SectionFacture brouillon={brouillon} analyse={analyse} modifier={modifier} />
            <SectionOccupants brouillon={brouillon} analyse={analyse} modifier={modifier} />
            <SectionReleves brouillon={brouillon} analyse={analyse} modifier={modifier} />
          </div>
          <PanneauControle brouillon={brouillon} analyse={analyse} modifier={modifier} calculer={calculer} />
        </div>
      </div>

      <BarreMobile analyse={analyse} calculer={calculer} />
      <ModaleApercu resultat={apercu ? analyse.resultat : null} fermer={() => setApercu(false)} />

      <Modal
        opened={confirmation !== null}
        onClose={() => setConfirmation(null)}
        title={confirmation === "vierge" ? "Brouillon vierge" : "Données d'exemple"}
      >
        <p style={{ marginTop: 0 }}>La saisie en cours sera remplacée. Continuer ?</p>
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
