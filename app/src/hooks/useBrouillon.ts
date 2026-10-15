import { useCallback, useEffect, useRef, useState } from "react";
import type { BrouillonCycle } from "../domaine/brouillon";
import { empreinte } from "../domaine/empreinte";
import { brouillonExemple } from "../domaine/exemple";
import type { Depot } from "../donnees/depot";

export type EtatChargement = "chargement" | "pret" | "erreur";

/**
 * Brouillon du cycle en cours : chargé depuis le dépôt, enregistré automatiquement après chaque
 * saisie, et mis à jour si un autre appareil le modifie.
 */
export function useBrouillon(depot: Depot) {
  const [brouillon, setBrouillon] = useState<BrouillonCycle | null>(null);
  const [etat, setEtat] = useState<EtatChargement>("chargement");
  const [enregistreA, setEnregistreA] = useState<Date | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  // Empreintes de la dernière version enregistrée et de celle en cours d'envoi : elles évitent
  // de renvoyer une version déjà enregistrée et d'écraser la saisie par l'écho de notre propre écriture.
  const enregistre = useRef<string | null>(null);
  const enCours = useRef<string | null>(null);

  useEffect(() => {
    let actif = true;
    depot
      .chargerBrouillon()
      .then((b) => {
        if (!actif) return;
        enregistre.current = b ? empreinte(b) : null;
        setBrouillon(b ?? brouillonExemple());
        setEtat("pret");
      })
      .catch((e: unknown) => {
        if (!actif) return;
        setErreur(e instanceof Error ? e.message : String(e));
        setEtat("erreur");
      });
    const arreter = depot.ecouterBrouillon?.((distant) => {
      const e = empreinte(distant);
      if (e === enregistre.current || e === enCours.current) return;
      enregistre.current = e;
      setBrouillon(distant);
    });
    return () => {
      actif = false;
      arreter?.();
    };
  }, [depot]);

  useEffect(() => {
    if (!brouillon || etat !== "pret") return;
    const e = empreinte(brouillon);
    if (e === enregistre.current) return;
    const minuterie = setTimeout(() => {
      enCours.current = e;
      depot
        .enregistrerBrouillon(brouillon)
        .then(() => {
          enregistre.current = e;
          setEnregistreA(new Date());
          setErreur(null);
        })
        .catch((err: unknown) => setErreur(`Enregistrement impossible : ${err instanceof Error ? err.message : String(err)}`));
    }, 800);
    return () => clearTimeout(minuterie);
  }, [brouillon, depot, etat]);

  /** Applique une modification sur une copie du brouillon. */
  const modifier = useCallback((modification: (b: BrouillonCycle) => void) => {
    setBrouillon((precedent) => {
      if (!precedent) return precedent;
      const suivant = structuredClone(precedent);
      modification(suivant);
      return suivant;
    });
  }, []);

  /** Remplace le brouillon. `dejaEnregistre` : il vient d'être écrit dans le dépôt (validation d'un cycle). */
  const remplacer = useCallback((b: BrouillonCycle, dejaEnregistre = false) => {
    if (dejaEnregistre) enregistre.current = empreinte(b);
    setBrouillon(b);
  }, []);

  return { brouillon, etat, erreur, modifier, remplacer, enregistreA };
}
