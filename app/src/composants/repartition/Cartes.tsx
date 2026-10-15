import { Badge, Button, Menu, ActionIcon } from "@mantine/core";
import { aPayer, kwh, montant, poids } from "../../domaine/format";
import { COULEURS_TRANCHES, type FoyerAffiche, type LogementVide } from "../../domaine/repartition";
import { PastilleLogement } from "../Section";

interface PropsFoyer {
  foyer: FoyerAffiche;
  joursCycle: number;
  /** kWh du plus gros consommateur : échelle commune des barres de tranches. */
  kwhMax: number;
  telecharger: () => void;
  voirSiSeul: () => void;
}

export function CarteFoyer({ foyer, joursCycle, kwhMax, telecharger, voirSiSeul }: PropsFoyer) {
  const p = foyer.participant;
  return (
    <article className="pj-carte">
      <div className="pj-carte-tete">
        <span style={{ display: "flex", gap: 6 }}>
          {foyer.logements.map((l) => (
            <PastilleLogement key={l.id} id={l.id} couleur={l.couleur} />
          ))}
        </span>
        <span className="pj-libelle pj-gris">{p.estime ? "Conso. estimée" : ""}</span>
      </div>
      <div className="pj-carte-corps">
        <div className="pj-qui">
          <h3>{p.nom ?? p.occupantId}</h3>
          <span className="pj-num">
            {p.jours} / {joursCycle} j · poids {poids(p.poids)}
          </span>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {foyer.etiquettes.map((e) => (
            <Badge key={e.texte} color={e.couleur}>
              {e.texte}
            </Badge>
          ))}
        </div>
        <div className="pj-kwh">
          <b>{kwh(p.kwhCorriges)} kWh</b>
          <span className="pj-num">
            {kwh(p.kwhMesures)} mesurés {p.partEcartKwh >= 0 ? "+" : "−"} {kwh(Math.abs(p.partEcartKwh))} d'écart
          </span>
        </div>
        <div className="pj-barre-tranches" title="Répartition par tranche">
          {p.kwhParTranche.map((q, i) => (
            <span key={i} style={{ width: `${kwhMax > 0 ? (q / kwhMax) * 100 : 0}%`, background: COULEURS_TRANCHES[i % 4] }} />
          ))}
        </div>
        <div className="pj-tranches-foyer">
          {p.kwhParTranche.map((q, i) => (
            <span key={i}>
              <i style={{ background: COULEURS_TRANCHES[i % 4] }} />T{i + 1} {kwh(q)}
            </span>
          ))}
        </div>
        <div className="pj-lignes">
          <span>Énergie</span>
          <span>{montant(p.energie)}</span>
          <span>Taxes</span>
          <span>{montant(p.totalTaxes)}</span>
          <span>Frais fixes</span>
          <span>{montant(p.totalFraisFixes)}</span>
          <span>TVA (franchise {montant(p.franchiseTva)})</span>
          <span>{montant(p.tva)}</span>
          {Math.abs(p.ajustement) >= 0.005 && (
            <>
              <span>Ajustement facture</span>
              <span>{montant(p.ajustement)}</span>
            </>
          )}
        </div>
        <div className="pj-total-foyer">
          <b>{aPayer(p.totalArrondi)} Ar</b>
          <span>{kwh(p.prixMoyenKwh)} Ar/kWh</span>
        </div>
      </div>
      <div className="pj-carte-actions">
        <Button onClick={telecharger}>Fiche PDF</Button>
        <Menu position="bottom-end">
          <Menu.Target>
            <ActionIcon variant="default" size={36} aria-label={`Plus d'actions pour ${p.nom ?? p.occupantId}`}>
              …
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item onClick={voirSiSeul}>Comparer avec un compteur individuel</Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </div>
    </article>
  );
}

export function CarteVide({ vide, joursCycle }: { vide: LogementVide; joursCycle: number }) {
  return (
    <article className="pj-carte" data-vide>
      <div className="pj-carte-tete">
        <PastilleLogement id={vide.logement.id} couleur={vide.logement.couleur} />
        <Badge color="gray">Vide</Badge>
      </div>
      <div className="pj-carte-corps">
        <div className="pj-qui">
          <h3>Logement vide</h3>
          <span className="pj-num">0 / {joursCycle} jours</span>
        </div>
        <p className="pj-gris">
          Sous-compteur : <b className="pj-num">{vide.kwhReleves !== null ? `${kwh(vide.kwhReleves)} kWh` : "—"}</b>, comptés
          dans l'écart.
        </p>
        <p className="pj-gris">Sa part de frais fixes et de franchise est répartie entre les présents.</p>
      </div>
    </article>
  );
}
