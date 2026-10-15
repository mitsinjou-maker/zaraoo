import { useCallback, useEffect, useState } from "react";
import type { BrouillonCycle } from "../domaine/brouillon";
import { brouillonExemple } from "../domaine/exemple";
import type { DepotBrouillon } from "../donnees/depot";

/** Brouillon du cycle en cours, enregistré automatiquement une demi-seconde après chaque saisie. */
export function useBrouillon(depot: DepotBrouillon) {
  const [brouillon, setBrouillon] = useState<BrouillonCycle>(() => depot.charger() ?? brouillonExemple());
  const [enregistreA, setEnregistreA] = useState<Date | null>(null);

  useEffect(() => {
    const minuterie = setTimeout(() => {
      depot.enregistrer(brouillon);
      setEnregistreA(new Date());
    }, 500);
    return () => clearTimeout(minuterie);
  }, [brouillon, depot]);

  /** Applique une modification sur une copie du brouillon. */
  const modifier = useCallback((modification: (b: BrouillonCycle) => void) => {
    setBrouillon((precedent) => {
      const suivant = structuredClone(precedent);
      modification(suivant);
      return suivant;
    });
  }, []);

  const remplacer = useCallback((b: BrouillonCycle) => setBrouillon(b), []);

  return { brouillon, modifier, remplacer, enregistreA };
}
