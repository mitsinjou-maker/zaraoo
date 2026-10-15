import { Alert, Button, Loader } from "@mantine/core";
import { useEffect, useMemo, useState } from "react";
import type { Compte, Rubrique } from "../composants/EnTete";
import { analyserBrouillon } from "../domaine/brouillon";
import { brouillonSuivant, figerCycle, type CycleValide } from "../domaine/cycles";
import type { Depot } from "../donnees/depot";
import { useBrouillon } from "../hooks/useBrouillon";
import { Historique } from "./Historique";
import { RepartitionCycle } from "./RepartitionCycle";
import { SaisieCycle } from "./SaisieCycle";

type Vue = { type: "saisie" } | { type: "repartition" } | { type: "historique" } | { type: "archive"; id: string };

function Attente({ texte }: { texte: string }) {
  return (
    <div className="pj-plein-ecran">
      <Loader color="dark" size="sm" />
      <span className="pj-libelle">{texte}</span>
    </div>
  );
}

/** Écrans de l'admin connecté (ou du mode local) : saisie, répartition, historique. */
export function EspaceAdmin({ depot, compte }: { depot: Depot; compte: Compte }) {
  const { brouillon, etat, erreur, modifier, remplacer, enregistreA } = useBrouillon(depot);
  const analyse = useMemo(() => (brouillon ? analyserBrouillon(brouillon) : null), [brouillon]);
  const [vue, setVue] = useState<Vue>({ type: "saisie" });

  // Chaque changement d'écran repart du haut de la page.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [vue]);

  const naviguer = (r: Rubrique) => setVue(r === "historique" ? { type: "historique" } : { type: "saisie" });

  if (etat === "erreur") {
    return (
      <div className="pj-plein-ecran">
        <Alert color="red" variant="light" radius={0} maw={480}>
          Impossible de charger les données : {erreur}
        </Alert>
        <Button variant="default" onClick={() => window.location.reload()}>
          Réessayer
        </Button>
      </div>
    );
  }
  if (!brouillon || !analyse) return <Attente texte="Chargement du cycle en cours" />;

  if (vue.type === "historique") {
    return (
      <Historique
        depot={depot}
        brouillon={brouillon}
        naviguer={naviguer}
        ouvrir={(id) => setVue({ type: "archive", id })}
        compte={compte}
      />
    );
  }

  if (vue.type === "archive") {
    return <CycleArchive key={vue.id} depot={depot} id={vue.id} naviguer={naviguer} compte={compte} />;
  }

  if (vue.type === "repartition" && analyse.resultat?.ok) {
    const valider = async () => {
      const cycle = figerCycle(brouillon, analyse.resultat!);
      const suivant = brouillonSuivant(brouillon);
      await depot.validerCycle(cycle, suivant);
      remplacer(suivant, true);
      setVue({ type: "archive", id: cycle.id });
    };
    return (
      <RepartitionCycle
        brouillon={brouillon}
        analyse={analyse}
        mode={{ type: "brouillon", versSaisie: () => setVue({ type: "saisie" }), valider, lieu: depot.lieu }}
        naviguer={naviguer}
        compte={compte}
      />
    );
  }

  return (
    <SaisieCycle
      brouillon={brouillon}
      analyse={analyse}
      modifier={modifier}
      remplacer={remplacer}
      enregistreA={enregistreA}
      erreurEnregistrement={erreur}
      lieu={depot.lieu}
      versRepartition={() => setVue({ type: "repartition" })}
      naviguer={naviguer}
      compte={compte}
    />
  );
}

/** Cycle validé, en lecture seule : les montants affichés sont ceux enregistrés à la validation. */
function CycleArchive({ depot, id, naviguer, compte }: { depot: Depot; id: string; naviguer: (r: Rubrique) => void; compte: Compte }) {
  const [cycle, setCycle] = useState<CycleValide | null | undefined>(undefined);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let actif = true;
    depot
      .chargerCycle(id)
      .then((c) => actif && setCycle(c))
      .catch((e: unknown) => actif && setErreur(e instanceof Error ? e.message : String(e)));
    return () => {
      actif = false;
    };
  }, [depot, id]);

  // Occupations recalculées depuis le brouillon figé, résultat repris tel qu'il a été validé.
  const analyse = useMemo(() => (cycle ? { ...analyserBrouillon(cycle.brouillon), resultat: cycle.resultat } : null), [cycle]);

  if (erreur || cycle === null) {
    return (
      <div className="pj-plein-ecran">
        <Alert color="red" variant="light" radius={0} maw={480}>
          {erreur ? `Impossible de charger ce cycle : ${erreur}` : "Ce cycle est introuvable."}
        </Alert>
        <Button variant="default" onClick={() => naviguer("historique")}>
          ← Historique
        </Button>
      </div>
    );
  }
  if (!cycle || !analyse) return <Attente texte="Chargement du cycle" />;

  return (
    <RepartitionCycle
      brouillon={cycle.brouillon}
      analyse={analyse}
      mode={{ type: "archive", valideLe: cycle.valideLe, retour: () => naviguer("historique") }}
      naviguer={naviguer}
      compte={compte}
    />
  );
}
