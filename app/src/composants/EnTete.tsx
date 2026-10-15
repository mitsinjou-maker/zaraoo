import { ActionIcon, Menu } from "@mantine/core";
import type { ReactNode } from "react";

export type Rubrique = "saisie" | "historique" | "logements" | "tarifs";

export interface Compte {
  /** Adresse de l'admin connecté, ou `null` en mode local (sans compte). */
  email: string | null;
  deconnecter?: () => void;
}

interface Props {
  actif?: Rubrique;
  naviguer?: (r: Rubrique) => void;
  droite?: ReactNode;
  compte?: Compte;
}

const RUBRIQUES: { cle: Rubrique; nom: string }[] = [
  { cle: "saisie", nom: "Cycle en cours" },
  { cle: "historique", nom: "Historique" },
  { cle: "logements", nom: "Logements" },
  { cle: "tarifs", nom: "Tarifs" },
];

export function EnTete({ actif, naviguer, droite, compte }: Props) {
  return (
    <header className="pj-entete">
      <div className="pj-marque">
        <i aria-hidden />
        <span>ZARAOO</span>
      </div>
      <nav className="pj-nav pj-libelle">
        {RUBRIQUES.map((r) => (
          <button key={r.cle} type="button" data-actif={actif === r.cle || undefined} onClick={() => naviguer?.(r.cle)}>
            {r.nom}
          </button>
        ))}
      </nav>
      {droite && <div className="pj-entete-droite">{droite}</div>}
      {compte && (
        <div className="pj-entete-droite" style={droite ? { marginLeft: 0 } : undefined}>
          <Menu position="bottom-end" width={240}>
            <Menu.Target>
              <ActionIcon variant="subtle" color="dark" aria-label="Menu">
                ☰
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              {RUBRIQUES.map((r) => (
                <Menu.Item key={r.cle} className="pj-seulement-mobile" onClick={() => naviguer?.(r.cle)}>
                  {r.nom}
                </Menu.Item>
              ))}
              <Menu.Label>{compte.email ?? "Mode local : données dans ce navigateur"}</Menu.Label>
              {compte.deconnecter && (
                <Menu.Item color="red" onClick={compte.deconnecter}>
                  Se déconnecter
                </Menu.Item>
              )}
            </Menu.Dropdown>
          </Menu>
        </div>
      )}
    </header>
  );
}
