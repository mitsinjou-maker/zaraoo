import type { ResultatCycle } from "@partage-jirama/moteur";
import type { BrouillonCycle } from "../../domaine/brouillon";
import { aPayer, dateFr, entier, kwh, montant, pourcent } from "../../domaine/format";
import { COULEURS_TRANCHES } from "../../domaine/repartition";

interface Props {
  brouillon: BrouillonCycle;
  resultat: ResultatCycle;
}

/** Section « 01 / Facture JIRAMA » : chiffres clés, tranches du bâtiment et écart. */
export function ResumeFacture({ brouillon, resultat }: Props) {
  const f = resultat.facture!;
  const ctl = resultat.controleFacture!;
  const ecart = resultat.ecart!;
  const t = resultat.totaux!;
  const b = brouillon.facture;
  const sommeArrondis = Math.round(resultat.participants.reduce((s, p) => s + p.totalArrondi, 0) * 100) / 100;

  return (
    <>
      <div className="pj-titre-section pj-libelle">
        <span>
          01 / <b>Facture JIRAMA</b>
        </span>
        <span>
          Période {dateFr(b.dateDebut).slice(0, 5)} → {dateFr(b.dateFin)} · {resultat.joursCycle} jours
        </span>
      </div>
      <div className="pj-stats">
        <div className="pj-stat">
          <span className="pj-libelle">Compteur</span>
          <div className="v">{entier(f.kwh)} kWh</div>
          <div className="s pj-num">
            Index {entier(b.indexDebut ?? 0)} → {entier(b.indexFin ?? 0)}
          </div>
        </div>
        <div className="pj-stat">
          <span className="pj-libelle">Énergie</span>
          <div className="v">{montant(f.energie)}</div>
          <div className="s">{f.tranches.filter((x) => x.kwh > 0).length} tranche(s)</div>
        </div>
        <div className="pj-stat">
          <span className="pj-libelle">Frais fixes</span>
          <div className="v">{montant(f.sousTotalJirama - f.energie)}</div>
          <div className="s">{f.fraisFixes.map((x) => x.libelle.split(" ")[0]).join(" + ")}</div>
        </div>
        <div className="pj-stat">
          <span className="pj-libelle">Taxes</span>
          <div className="v">{montant(f.sousTotalTaxes)}</div>
          <div className="s">{f.energie > 0 ? `${pourcent(f.sousTotalTaxes / f.energie)} de l'énergie` : "—"}</div>
        </div>
        <div className="pj-stat">
          <span className="pj-libelle">TVA</span>
          <div className="v">{montant(f.tva)}</div>
          <div className="s">après franchise de {montant(f.franchiseTva)}</div>
        </div>
        <div className="pj-stat">
          <span className="pj-libelle">Contrôle</span>
          <div className={`v ${ctl.coherent ? "pj-ok" : "pj-erreur"}`}>
            {ctl.coherent ? "✓ " : "! "}
            {montant(ctl.difference)}
          </div>
          <div className="s">{ctl.coherent ? "Recalcul = saisie" : "Facture acceptée telle quelle"}</div>
        </div>
        <div className="pj-stat" data-total>
          <span className="pj-libelle">Total à répartir</span>
          <div className="v">{montant(ctl.totalSaisi)} Ar</div>
          <div className={`s ${sommeArrondis === t.totalArrondi ? "pj-ok" : ""}`}>
            {t.reliquatArrondi === 0 ? "Σ des parts = facture" : `Σ des parts = ${aPayer(sommeArrondis)} (arrondi à l'Ariary)`}
          </div>
        </div>
      </div>

      <div className="pj-batiment">
        <div>
          <span className="pj-libelle pj-gris">Tranches du bâtiment</span>
          <div className="pj-barre-tranches">
            {f.tranches.map((tr, i) => (
              <span key={i} style={{ width: `${f.kwh > 0 ? (tr.kwh / f.kwh) * 100 : 0}%`, background: COULEURS_TRANCHES[i % 4] }} />
            ))}
          </div>
          <div className="pj-legende pj-num">
            {f.tranches.map((tr, i) =>
              tr.kwh > 0 ? (
                <span key={i}>
                  <i style={{ background: COULEURS_TRANCHES[i % 4] }} />T{i + 1} · {kwh(tr.kwh)} kWh × {entier(tr.prixKwh)}
                </span>
              ) : null,
            )}
          </div>
        </div>
        <div>
          <span className="pj-libelle pj-gris">Écart compteur / sous-compteurs</span>
          <div className="pj-cle-valeur" style={{ marginTop: 6 }}>
            <span>Compteur JIRAMA</span>
            <span className="pj-num">{kwh(ecart.compteurPrincipalKwh)} kWh</span>
          </div>
          <div className="pj-cle-valeur">
            <span>Σ participants ({resultat.participants.length})</span>
            <span className="pj-num">− {kwh(ecart.sommeParticipantsKwh)} kWh</span>
          </div>
          <div className="pj-cle-valeur somme">
            <span>{ecart.mode === "egal" ? "Écart → réparti selon la présence" : "Écart négatif → réduction proportionnelle"}</span>
            <span className="pj-num">
              {kwh(ecart.ecartKwh)} kWh · {pourcent(ecart.ecartRelatif)}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
