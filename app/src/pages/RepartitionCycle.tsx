import { Alert, Badge, Button, Group, Modal, NativeSelect, Tooltip } from "@mantine/core";
import { useMemo, useState } from "react";
import { EnTete, type Compte, type Rubrique } from "../composants/EnTete";
import { CarteFoyer, CarteVide } from "../composants/repartition/Cartes";
import { ResumeFacture } from "../composants/repartition/ResumeFacture";
import { TableauRepartition } from "../composants/repartition/TableauRepartition";
import type { Analyse, BrouillonCycle } from "../domaine/brouillon";
import { aPayer, dateFr, kwh, montant, pourcent } from "../domaine/format";
import { bilanRegularisation } from "../domaine/regularisation";
import { foyersDuCycle, trierFoyers, type FoyerAffiche, type Tri } from "../domaine/repartition";
import type { Depot } from "../donnees/depot";
import { telechargerFiches } from "../pdf/fiches";

type Filtre = "tous" | "present" | "demenagement" | "vide";
type Vue = "grille" | "tableau";

/** Répartition du cycle en cours (modifiable, à valider) ou d'un cycle validé (figé). */
export type ModeRepartition =
  | { type: "brouillon"; versSaisie: () => void; valider: () => Promise<void>; lieu: Depot["lieu"] }
  | {
      type: "archive";
      valideLe: string;
      retour: () => void;
      /** Présent si cette validation peut encore être annulée (dernier cycle, moins de 30 jours). */
      annulation?: { saisiePerdue: boolean; annuler: () => Promise<void> };
    };

interface Props {
  brouillon: BrouillonCycle;
  analyse: Analyse;
  mode: ModeRepartition;
  naviguer: (r: Rubrique) => void;
  compte: Compte;
}

export function RepartitionCycle({ brouillon, analyse, mode, naviguer, compte }: Props) {
  const resultat = analyse.resultat!;
  const [confirmation, setConfirmation] = useState(false);
  const [confirmationAnnulation, setConfirmationAnnulation] = useState(false);
  const [validation, setValidation] = useState<{ enCours: boolean; erreur: string | null }>({ enCours: false, erreur: null });
  const { foyers, vides } = useMemo(() => foyersDuCycle(brouillon, analyse), [brouillon, analyse]);
  const [vue, setVue] = useState<Vue>("grille");
  const [filtre, setFiltre] = useState<Filtre>("tous");
  const [tri, setTri] = useState<Tri>("logement");
  const [export_, setExport] = useState<string | null>(null);
  const [erreurPdf, setErreurPdf] = useState<string | null>(null);
  const [comparaison, setComparaison] = useState<FoyerAffiche | null>(null);

  const visibles = trierFoyers(
    foyers.filter((f) => filtre === "tous" || f.categorie === filtre),
    tri,
  );
  const videsVisibles = filtre === "tous" || filtre === "vide" ? vides : [];
  const kwhMax = Math.max(0, ...foyers.map((f) => f.participant.kwhCorriges));
  const avertissements = resultat.diagnostics.filter((d) => d.niveau === "avertissement");
  const t = resultat.totaux!;
  const ecart = resultat.ecart!;
  const bilan = useMemo(() => bilanRegularisation(brouillon, resultat), [brouillon, resultat]);
  const ctx = { brouillon, resultat, bilan };
  const estimee = brouillon.facture.estimee;

  const exporter = async (cible: FoyerAffiche[], cle: string) => {
    setExport(cle);
    setErreurPdf(null);
    try {
      await telechargerFiches(ctx, cible);
    } catch (e) {
      setErreurPdf(e instanceof Error ? e.message : String(e));
    } finally {
      setExport(null);
    }
  };

  const valider = async () => {
    if (mode.type !== "brouillon") return;
    setValidation({ enCours: true, erreur: null });
    try {
      await mode.valider();
    } catch (e) {
      setValidation({ enCours: false, erreur: e instanceof Error ? e.message : String(e) });
    }
  };

  const annulerValidation = async () => {
    if (mode.type !== "archive" || !mode.annulation) return;
    setValidation({ enCours: true, erreur: null });
    try {
      await mode.annulation.annuler();
    } catch (e) {
      setValidation({ enCours: false, erreur: e instanceof Error ? e.message : String(e) });
    }
  };

  const onglets: { cle: Filtre; texte: string; nombre: number }[] = [
    { cle: "tous", texte: "Tous", nombre: foyers.length + vides.length },
    { cle: "present", texte: "Présents", nombre: foyers.filter((f) => f.categorie === "present").length },
    { cle: "demenagement", texte: "Déménagements", nombre: foyers.filter((f) => f.categorie === "demenagement").length },
    { cle: "vide", texte: "Vides", nombre: vides.length },
  ];

  return (
    <>
      <EnTete
        actif={mode.type === "archive" ? "historique" : "saisie"}
        naviguer={naviguer}
        compte={compte}
        droite={
          <div className="pj-seg pj-libelle" role="group" aria-label="Affichage">
            <button type="button" data-actif={vue === "grille" || undefined} onClick={() => setVue("grille")}>
              Grille
            </button>
            <button type="button" data-actif={vue === "tableau" || undefined} onClick={() => setVue("tableau")}>
              Tableau
            </button>
          </div>
        }
      />

      <main className="pj-page">
        <div className="pj-fil pj-libelle">
          <span>{mode.type === "archive" ? "Historique" : "Cycles"}</span>
          <span>/</span>
          <b>{brouillon.facture.mois || "Nouveau cycle"}</b>
          <span>/</span>
          <b>Répartition</b>
          {brouillon.exemple && <Badge color="orange">Données d'exemple</Badge>}
          {estimee && <Badge color="orange">Facture estimée</Badge>}
          {bilan && <Badge color="blue">Régularisation</Badge>}
        </div>

        {mode.type === "brouillon" ? (
          <div className="pj-bandeau">
            <span className="pj-pastille pj-libelle">Brouillon</span>
            <p>
              <b>Répartition calculée.</b>{" "}
              {avertissements.length === 0
                ? "Facture contrôlée, aucun avertissement."
                : `${avertissements.length} avertissement${avertissements.length > 1 ? "s" : ""} : ${avertissements.map((a) => a.message).join(" ")}`}
            </p>
            <Button variant="default" onClick={mode.versSaisie}>
              ← Modifier la saisie
            </Button>
            <Tooltip
              label="Données d'exemple : commencez un brouillon vierge pour valider un vrai cycle"
              multiline
              w={260}
              disabled={!brouillon.exemple}
            >
              <span className="pj-bandeau-action">
                <Button fullWidth disabled={brouillon.exemple} onClick={() => setConfirmation(true)}>
                  Valider le cycle
                </Button>
              </span>
            </Tooltip>
          </div>
        ) : (
          <div className="pj-bandeau" data-valide>
            <span className="pj-pastille pj-libelle" data-valide>
              Validé
            </span>
            <p>
              <b>Cycle validé le {new Date(mode.valideLe).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })}.</b>{" "}
              Montants figés : ils ne changent plus, même si les tarifs ou les règles évoluent.
            </p>
            <Button variant="default" onClick={mode.retour}>
              ← Historique
            </Button>
            {mode.annulation && (
              <Button variant="default" color="red" className="pj-bandeau-action" onClick={() => setConfirmationAnnulation(true)}>
                Annuler la validation
              </Button>
            )}
          </div>
        )}

        {bilan && (
          <Alert color="blue" variant="light" radius={0} mb="lg" title={`Régularisation de la facture estimée de ${bilan.regularisation.mois}`}>
            Les parts couvrent les deux périodes, avec les vrais index. Les foyers ont déjà payé{" "}
            {aPayer(bilan.sommeCredits)} Ar pour {bilan.regularisation.mois} : ils ne paient que la différence,{" "}
            <b>{aPayer(bilan.sommeNets)} Ar</b> au total
            {bilan.creditsSansParticipant.length > 0 &&
              ` (hors ${bilan.creditsSansParticipant.map((c) => `${c.nom}, ${aPayer(c.montant)} Ar`).join(" ; ")} : à régler à part)`}
            .
          </Alert>
        )}

        <ResumeFacture brouillon={brouillon} resultat={resultat} />

        <div className="pj-titre-section pj-libelle">
          <span>
            02 / <b>Répartition</b>
          </span>
          <span>Partage sériel · quotas égaux par jour de présence</span>
        </div>

        <div className="pj-outils">
          <div className="pj-onglets pj-libelle" role="tablist">
            {onglets.map((o) => (
              <button
                key={o.cle}
                type="button"
                role="tab"
                aria-selected={filtre === o.cle}
                data-actif={filtre === o.cle || undefined}
                onClick={() => setFiltre(o.cle)}
              >
                {o.texte}
                <em>{o.nombre}</em>
              </button>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <NativeSelect
            className="pj-tri"
            aria-label="Trier par"
            value={tri}
            onChange={(e) => setTri(e.currentTarget.value as Tri)}
            data={[
              { value: "logement", label: "Tri : logement" },
              { value: "montant", label: "Tri : montant" },
              { value: "nom", label: "Tri : nom" },
            ]}
          />
          <Button loading={export_ === "tous"} disabled={foyers.length === 0} onClick={() => exporter(trierFoyers(foyers, "logement"), "tous")}>
            Exporter les fiches (PDF)
          </Button>
        </div>
        {erreurPdf && <p className="pj-erreur">La création du PDF a échoué : {erreurPdf}</p>}

        {vue === "grille" ? (
          <div className="pj-grille">
            {visibles.map((f) => (
              <CarteFoyer
                key={f.participant.occupantId}
                foyer={f}
                joursCycle={resultat.joursCycle}
                kwhMax={kwhMax}
                telecharger={() => exporter([f], f.participant.occupantId)}
                voirSiSeul={() => setComparaison(f)}
                regularisation={(() => {
                  const n = bilan?.parFoyer.get(f.participant.occupantId);
                  return n && bilan ? { ...n, mois: bilan.regularisation.mois } : undefined;
                })()}
              />
            ))}
            {videsVisibles.map((v) => (
              <CarteVide key={v.logement.id} vide={v} joursCycle={resultat.joursCycle} />
            ))}
          </div>
        ) : (
          <TableauRepartition foyers={visibles} vides={videsVisibles} resultat={resultat} complet={filtre === "tous"} bilan={bilan} />
        )}
      </main>

      <footer className="pj-barre-etat pj-libelle">
        <div>
          <span>
            <i className="pj-point" style={mode.type === "archive" ? { background: "var(--ok)" } : undefined} />
            {mode.type === "archive" ? "Validé" : "Brouillon"}
          </span>
          <span>{resultat.controleFacture?.coherent ? "Facture vérifiée" : "Facture acceptée telle quelle"}</span>
          <span>Écart {pourcent(ecart.ecartRelatif)}</span>
          <span>Σ réparti = {aPayer(t.totalArrondi)} Ar</span>
          {bilan && <span>Net = {aPayer(bilan.sommeNets)} Ar</span>}
        </div>
        <span>{kwh(t.kwh)} kWh répartis</span>
      </footer>

      <Modal opened={comparaison !== null} onClose={() => setComparaison(null)} title="Comparer avec un compteur individuel">
        {comparaison && (
          <>
            <p style={{ marginTop: 0 }}>
              <b>{comparaison.participant.nom}</b> a consommé {kwh(comparaison.participant.kwhMesures)} kWh sur son sous-compteur.
            </p>
            <div className="pj-cle-valeur">
              <span>Avec son propre compteur JIRAMA</span>
              <span className="pj-num">{montant(comparaison.participant.totalSiCompteurIndividuel)} Ar</span>
            </div>
            <div className="pj-cle-valeur somme">
              <span>Dans le partage du bâtiment</span>
              <span className="pj-num">{aPayer(comparaison.participant.totalArrondi)} Ar</span>
            </div>
            <p className="pj-aide">
              Indicatif : un compteur individuel paierait seul la redevance et la prime fixe, mais resterait plus longtemps dans les
              tranches bon marché.
            </p>
          </>
        )}
      </Modal>

      <Modal
        opened={confirmation}
        onClose={() => !validation.enCours && setConfirmation(false)}
        title="Valider le cycle"
      >
        <p style={{ marginTop: 0 }}>
          Le cycle <b>{brouillon.facture.mois || "en cours"}</b> sera <b>figé</b> : les {resultat.participants.length} parts (
          {aPayer(t.totalArrondi)} Ar au total) ne pourront plus être modifiées.
        </p>
        {estimee ? (
          <p>
            <b>Facture estimée :</b> le cycle suivant sera une régularisation. Il repartira du dernier index réel (le{" "}
            {dateFr(brouillon.facture.dateDebut)}) pour couvrir les deux périodes, et chaque foyer y sera crédité de ce qu'il
            paie maintenant.
          </p>
        ) : (
          <p>
            Le cycle suivant sera préparé automatiquement : il commencera le {dateFr(brouillon.facture.dateFin)}{" "}
            avec les derniers index relevés, les mêmes logements et les occupants encore présents.
          </p>
        )}
        {mode.type === "brouillon" && mode.lieu === "navigateur" && (
          <Alert color="orange" variant="light" radius={0} mb="sm">
            Mode local : le cycle validé est rangé dans ce navigateur seulement.
          </Alert>
        )}
        {validation.erreur && (
          <Alert color="red" variant="light" radius={0} mb="sm">
            La validation a échoué : {validation.erreur}
          </Alert>
        )}
        <Group justify="flex-end">
          <Button variant="default" disabled={validation.enCours} onClick={() => setConfirmation(false)}>
            Annuler
          </Button>
          <Button loading={validation.enCours} onClick={valider}>
            Valider et figer
          </Button>
        </Group>
      </Modal>

      <Modal
        opened={confirmationAnnulation}
        onClose={() => !validation.enCours && setConfirmationAnnulation(false)}
        title="Annuler la validation"
      >
        <p style={{ marginTop: 0 }}>
          Le cycle <b>{brouillon.facture.mois}</b> redeviendra le cycle en cours, modifiable, et disparaîtra de l'historique
          jusqu'à sa prochaine validation.
        </p>
        {mode.type === "archive" && mode.annulation?.saisiePerdue && (
          <Alert color="orange" variant="light" radius={0} mb="sm">
            Le cycle suivant a déjà été commencé : cette saisie sera perdue et remplacée par ce cycle.
          </Alert>
        )}
        {validation.erreur && (
          <Alert color="red" variant="light" radius={0} mb="sm">
            L'annulation a échoué : {validation.erreur}
          </Alert>
        )}
        <Group justify="flex-end">
          <Button variant="default" disabled={validation.enCours} onClick={() => setConfirmationAnnulation(false)}>
            Garder la validation
          </Button>
          <Button color="red" loading={validation.enCours} onClick={annulerValidation}>
            Annuler la validation
          </Button>
        </Group>
      </Modal>
    </>
  );
}
