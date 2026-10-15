import { ActionIcon, Button, Group, Menu, Modal } from "@mantine/core";
import { useState, type ReactNode } from "react";

export type Rubrique = "saisie" | "historique" | "logements" | "tarifs";

export interface Compte {
  /** Adresse de l'admin connecté, ou `null` sans compte (mode local ou essai). */
  email: string | null;
  deconnecter?: () => void;
  /** Mode essai sans compte : les données restent dans ce navigateur. */
  essai?: { quitter: (effacer: boolean) => void };
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
  const [confirmerEffacement, setConfirmerEffacement] = useState(false);
  const essai = compte?.essai;

  return (
    <>
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
            <Menu position="bottom-end" width={260}>
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
                <Menu.Label>
                  {compte.email ?? (essai ? "Mode essai : données dans ce navigateur" : "Mode local : données dans ce navigateur")}
                </Menu.Label>
                {compte.deconnecter && (
                  <Menu.Item color="red" onClick={compte.deconnecter}>
                    Se déconnecter
                  </Menu.Item>
                )}
                {essai && (
                  <>
                    <Menu.Item onClick={() => essai.quitter(false)}>Quitter l'essai (garder les données)</Menu.Item>
                    <Menu.Item color="red" onClick={() => setConfirmerEffacement(true)}>
                      Effacer les données et quitter
                    </Menu.Item>
                  </>
                )}
              </Menu.Dropdown>
            </Menu>
          </div>
        )}
      </header>

      {essai && (
        <div className="pj-bandeau-essai" role="note">
          <b>Mode essai</b>
          <span>Vos données restent dans ce navigateur, sur cet appareil. Rien n'est envoyé en ligne.</span>
        </div>
      )}

      {essai && (
        <Modal opened={confirmerEffacement} onClose={() => setConfirmerEffacement(false)} title="Effacer les données d'essai">
          <p style={{ marginTop: 0 }}>
            Les logements, cycles, tarifs et saisies de l'essai seront supprimés de ce navigateur. Pour les garder,
            exportez d'abord une sauvegarde depuis l'historique.
          </p>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setConfirmerEffacement(false)}>
              Annuler
            </Button>
            <Button color="red" onClick={() => essai.quitter(true)}>
              Effacer et quitter
            </Button>
          </Group>
        </Modal>
      )}
    </>
  );
}
