import { Tooltip } from "@mantine/core";
import type { ReactNode } from "react";

const RUBRIQUES = [
  { nom: "Cycles", disponible: true },
  { nom: "Foyers", disponible: false },
  { nom: "Logements", disponible: false },
  { nom: "Tarifs", disponible: false },
];

export function EnTete({ droite }: { droite?: ReactNode }) {
  return (
    <header className="pj-entete">
      <div className="pj-marque">
        <i aria-hidden />
        PARTAGE JIRAMA
      </div>
      <nav className="pj-nav pj-libelle">
        {RUBRIQUES.map((r) =>
          r.disponible ? (
            <button key={r.nom} type="button" data-actif>
              {r.nom}
            </button>
          ) : (
            <Tooltip key={r.nom} label="Bientôt disponible">
              <button type="button" disabled>
                {r.nom}
              </button>
            </Tooltip>
          ),
        )}
      </nav>
      {droite && <div className="pj-entete-droite">{droite}</div>}
    </header>
  );
}
