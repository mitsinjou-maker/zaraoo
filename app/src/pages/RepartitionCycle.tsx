import { Badge, Button, Modal, NativeSelect, Tooltip } from "@mantine/core";
import { useMemo, useState } from "react";
import { EnTete } from "../composants/EnTete";
import { CarteFoyer, CarteVide } from "../composants/repartition/Cartes";
import { ResumeFacture } from "../composants/repartition/ResumeFacture";
import { TableauRepartition } from "../composants/repartition/TableauRepartition";
import type { Analyse, BrouillonCycle } from "../domaine/brouillon";
import { aPayer, kwh, montant, pourcent } from "../domaine/format";
import { foyersDuCycle, trierFoyers, type FoyerAffiche, type Tri } from "../domaine/repartition";
import { telechargerFiches } from "../pdf/fiches";

type Filtre = "tous" | "present" | "demenagement" | "vide";
type Vue = "grille" | "tableau";

interface Props {
  brouillon: BrouillonCycle;
  analyse: Analyse;
  versSaisie: () => void;
}

export function RepartitionCycle({ brouillon, analyse, versSaisie }: Props) {
  const resultat = analyse.resultat!;
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
  const ctx = { brouillon, resultat };

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

  const onglets: { cle: Filtre; texte: string; nombre: number }[] = [
    { cle: "tous", texte: "Tous", nombre: foyers.length + vides.length },
    { cle: "present", texte: "Présents", nombre: foyers.filter((f) => f.categorie === "present").length },
    { cle: "demenagement", texte: "Déménagements", nombre: foyers.filter((f) => f.categorie === "demenagement").length },
    { cle: "vide", texte: "Vides", nombre: vides.length },
  ];

  return (
    <>
      <EnTete
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
          <span>Cycles</span>
          <span>/</span>
          <b>{brouillon.facture.mois || "Nouveau cycle"}</b>
          <span>/</span>
          <b>Répartition</b>
          {brouillon.exemple && <Badge color="orange">Données d'exemple</Badge>}
        </div>

        <div className="pj-bandeau">
          <span className="pj-pastille pj-libelle">Brouillon</span>
          <p>
            <b>Répartition calculée.</b>{" "}
            {avertissements.length === 0
              ? "Facture contrôlée, aucun avertissement."
              : `${avertissements.length} avertissement${avertissements.length > 1 ? "s" : ""} : ${avertissements.map((a) => a.message).join(" ")}`}
          </p>
          <Button variant="default" onClick={versSaisie}>
            ← Modifier la saisie
          </Button>
          <Tooltip label="Disponible avec l'enregistrement des cycles (Firebase)" multiline w={240}>
            <span>
              <Button disabled fullWidth>
                Valider le cycle
              </Button>
            </span>
          </Tooltip>
        </div>

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
              />
            ))}
            {videsVisibles.map((v) => (
              <CarteVide key={v.logement.id} vide={v} joursCycle={resultat.joursCycle} />
            ))}
          </div>
        ) : (
          <TableauRepartition foyers={visibles} vides={videsVisibles} resultat={resultat} complet={filtre === "tous"} />
        )}
      </main>

      <footer className="pj-barre-etat pj-libelle">
        <div>
          <span>
            <i className="pj-point" />
            Brouillon
          </span>
          <span>{resultat.controleFacture?.coherent ? "Facture vérifiée" : "Facture acceptée telle quelle"}</span>
          <span>Écart {pourcent(ecart.ecartRelatif)}</span>
          <span>Σ réparti = {aPayer(t.totalArrondi)} Ar</span>
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
    </>
  );
}
