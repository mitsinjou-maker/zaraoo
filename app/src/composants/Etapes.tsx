export type EtatEtape = "ok" | "alerte" | "erreur" | "neutre";

export interface Etape {
  ancre: string;
  titre: string;
  etat: EtatEtape;
  texte: string;
}

/** Bandeau des quatre étapes de saisie, avec l'état de chacune. */
export function Etapes({ etapes }: { etapes: Etape[] }) {
  return (
    <nav className="pj-etapes pj-libelle" aria-label="Étapes de la saisie">
      {etapes.map((e, i) => (
        <a key={e.ancre} href={`#${e.ancre}`}>
          <span className="n">{String(i + 1).padStart(2, "0")}</span>
          <span>{e.titre}</span>
          <span className="etat" data-etat={e.etat}>
            {e.texte}
          </span>
        </a>
      ))}
    </nav>
  );
}
