import { Alert, Button, Loader } from "@mantine/core";
import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Compte, Rubrique } from "../composants/EnTete";
import { analyserBrouillon, type BrouillonCycle } from "../domaine/brouillon";
import { brouillonSuivant, figerCycle, peutEtreAnnule, type CycleValide } from "../domaine/cycles";
import { empreinte } from "../domaine/empreinte";
import type { Depot } from "../donnees/depot";
import { useBrouillon } from "../hooks/useBrouillon";
import { useReglages } from "../hooks/useReglages";
import { SaisieCycle } from "./SaisieCycle";

// Écrans secondaires chargés à la première ouverture ; la saisie, écran d'arrivée, reste dans ce module.
const Historique = lazy(() => import("./Historique").then((m) => ({ default: m.Historique })));
const Logements = lazy(() => import("./Logements").then((m) => ({ default: m.Logements })));
const RepartitionCycle = lazy(() => import("./RepartitionCycle").then((m) => ({ default: m.RepartitionCycle })));
const Tarifs = lazy(() => import("./Tarifs").then((m) => ({ default: m.Tarifs })));

type Vue =
  | { type: "saisie" }
  | { type: "repartition" }
  | { type: "historique" }
  | { type: "logements" }
  | { type: "tarifs" }
  | { type: "archive"; id: string };

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
  const { reglages, etat: etatReglages, erreur: erreurReglages, enregistrer: enregistrerReglages } = useReglages(depot);
  const analyse = useMemo(
    () => (brouillon && reglages ? analyserBrouillon(brouillon, reglages.parametres) : null),
    [brouillon, reglages],
  );
  const [vue, setVue] = useState<Vue>({ type: "saisie" });

  // Chaque changement d'écran repart du haut de la page.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [vue]);

  const naviguer = (r: Rubrique) => setVue({ type: r });

  if (etat === "erreur" || etatReglages === "erreur") {
    return (
      <div className="pj-plein-ecran">
        <Alert color="red" variant="light" radius={0} maw={480}>
          Impossible de charger les données : {etat === "erreur" ? erreur : erreurReglages}
        </Alert>
        <Button variant="default" onClick={() => window.location.reload()}>
          Réessayer
        </Button>
      </div>
    );
  }
  if (!brouillon || !reglages || !analyse) return <Attente texte="Chargement du cycle en cours" />;

  const ecran = (): ReactNode => {
    if (vue.type === "tarifs") {
      return (
        <Tarifs
          reglages={reglages}
          enregistrer={enregistrerReglages}
          brouillon={brouillon}
          modifier={modifier}
          naviguer={naviguer}
          compte={compte}
        />
      );
    }

    if (vue.type === "historique") {
      return (
        <Historique
          depot={depot}
          brouillon={brouillon}
          reglages={reglages}
          naviguer={naviguer}
          ouvrir={(id) => setVue({ type: "archive", id })}
          compte={compte}
        />
      );
    }

    if (vue.type === "logements") {
      return <Logements brouillon={brouillon} modifier={modifier} naviguer={naviguer} compte={compte} />;
    }

    if (vue.type === "archive") {
      return (
        <CycleArchive
          key={vue.id}
          depot={depot}
          id={vue.id}
          brouillonEnCours={brouillon}
          apresAnnulation={(b) => {
            remplacer(b, true);
            setVue({ type: "saisie" });
          }}
          naviguer={naviguer}
          compte={compte}
        />
      );
    }

    if (vue.type === "repartition" && analyse.resultat?.ok) {
      const valider = async () => {
        const cycle = figerCycle(brouillon, analyse.resultat!, new Date(), analyse.parametres);
        const suivant = brouillonSuivant(brouillon, cycle);
        try {
          await depot.validerCycle(cycle, suivant);
        } catch (e) {
          // Les règles Firestore refusent une date de validation à plus d'une heure de l'heure du serveur.
          if ((e as { code?: string }).code === "permission-denied") {
            throw new Error("refusée par le serveur. Vérifiez la date et l'heure de cet appareil, puis réessayez.");
          }
          throw e;
        }
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
        reglages={reglages}
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
  };

  return <Suspense fallback={<Attente texte="Chargement" />}>{ecran()}</Suspense>;
}

interface PropsArchive {
  depot: Depot;
  id: string;
  /** Brouillon actuel : sert à prévenir que l'annulation remplacera la saisie du cycle suivant. */
  brouillonEnCours: BrouillonCycle;
  apresAnnulation: (brouillonRestaure: BrouillonCycle) => void;
  naviguer: (r: Rubrique) => void;
  compte: Compte;
}

/** Cycle validé, en lecture seule : les montants affichés sont ceux enregistrés à la validation. */
function CycleArchive({ depot, id, brouillonEnCours, apresAnnulation, naviguer, compte }: PropsArchive) {
  const [cycle, setCycle] = useState<CycleValide | null | undefined>(undefined);
  const [plusRecentId, setPlusRecentId] = useState<string | undefined>(undefined);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let actif = true;
    Promise.all([depot.chargerCycle(id), depot.dernierCycleId()])
      .then(([c, dernier]) => {
        if (!actif) return;
        setCycle(c);
        setPlusRecentId(dernier);
      })
      .catch((e: unknown) => actif && setErreur(e instanceof Error ? e.message : String(e)));
    return () => {
      actif = false;
    };
  }, [depot, id]);

  // Occupations recalculées depuis le brouillon figé (avec les règles de sa validation), résultat
  // repris tel qu'il a été validé.
  const analyse = useMemo(
    () => (cycle ? { ...analyserBrouillon(cycle.brouillon, cycle.parametres), resultat: cycle.resultat } : null),
    [cycle],
  );

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

  const annulation = peutEtreAnnule(cycle, plusRecentId)
    ? {
        // La saisie du cycle suivant a-t-elle avancé depuis la validation ?
        saisiePerdue: empreinte(brouillonEnCours) !== empreinte(brouillonSuivant(cycle.brouillon, cycle)),
        annuler: async () => {
          await depot.annulerValidation(cycle);
          apresAnnulation(cycle.brouillon);
        },
      }
    : undefined;

  return (
    <RepartitionCycle
      brouillon={cycle.brouillon}
      analyse={analyse}
      mode={{ type: "archive", valideLe: cycle.valideLe, retour: () => naviguer("historique"), annulation }}
      naviguer={naviguer}
      compte={compte}
    />
  );
}
