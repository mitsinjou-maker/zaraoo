import { useCallback, useEffect, useState } from "react";
import { reglagesParDefaut, type Reglages } from "../domaine/reglages";
import type { Depot } from "../donnees/depot";
import type { EtatChargement } from "./useBrouillon";

/** Grilles tarifaires et règles de répartition : chargées depuis le dépôt, enregistrées à la demande. */
export function useReglages(depot: Depot) {
  const [reglages, setReglages] = useState<Reglages | null>(null);
  const [etat, setEtat] = useState<EtatChargement>("chargement");
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let actif = true;
    depot
      .chargerReglages()
      .then((r) => {
        if (!actif) return;
        setReglages(r ?? reglagesParDefaut());
        setEtat("pret");
      })
      .catch((e: unknown) => {
        if (!actif) return;
        setErreur(e instanceof Error ? e.message : String(e));
        setEtat("erreur");
      });
    return () => {
      actif = false;
    };
  }, [depot]);

  const enregistrer = useCallback(
    async (r: Reglages) => {
      await depot.enregistrerReglages(r);
      setReglages(r);
    },
    [depot],
  );

  return { reglages, etat, erreur, enregistrer };
}
