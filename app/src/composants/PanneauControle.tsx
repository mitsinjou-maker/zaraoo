import { Button, Checkbox } from "@mantine/core";
import type { Diagnostic, NiveauDiagnostic } from "@partage-jirama/moteur";
import type { Analyse, BrouillonCycle } from "../domaine/brouillon";
import { kwh, montant, poids as formatPoids, pourcent } from "../domaine/format";

interface Verification {
  niveau: NiveauDiagnostic | "ok";
  texte: string;
  valeur?: string;
}

const ICONES: Record<Verification["niveau"], string> = { ok: "✓", info: "i", avertissement: "!", erreur: "✕" };

/** Codes déjà résumés par les lignes fixes du panneau. */
const CODES_RESUMES = new Set(["FACTURE_INCOHERENTE", "ECART_ELEVE", "ECART_NEGATIF"]);

function verifications(brouillon: BrouillonCycle, analyse: Analyse): Verification[] {
  const res = analyse.resultat;
  const liste: Verification[] = [];
  const f = brouillon.facture;

  if (analyse.facture && f.totalSaisi !== null) {
    const diff = Math.round((f.totalSaisi - analyse.facture.total) * 100) / 100;
    const coherent = Math.abs(diff) <= 1;
    liste.push({
      niveau: coherent ? "ok" : brouillon.parametres.forcerFacture ? "avertissement" : "erreur",
      texte: coherent ? "Facture recalculée = saisie" : "Facture saisie ≠ recalculée",
      valeur: `${diff > 0 ? "+" : ""}${montant(diff)}`,
    });
  }

  const participants = new Set(analyse.occupations.map((o) => o.occupation.occupantId)).size;
  const poids = analyse.occupations.reduce((s, o) => s + o.poids, 0);
  liste.push({
    niveau: participants > 0 ? "ok" : "erreur",
    texte: participants > 0 ? `Occupants : ${participants} participant${participants > 1 ? "s" : ""}` : "Aucun occupant pendant le cycle",
    valeur: participants > 0 ? `Σ poids ${formatPoids(poids)}` : undefined,
  });

  const relevesManquants = analyse.manquants.some((m) => m.section === "releves");
  liste.push({
    niveau: relevesManquants ? "erreur" : "ok",
    texte: "Relevés saisis",
    valeur: `${analyse.releves.saisis}/${analyse.releves.attendus}`,
  });

  if (res?.ecart) {
    const diag = res.diagnostics.find((d) => d.code === "ECART_ELEVE" || d.code === "ECART_NEGATIF");
    liste.push({
      niveau: diag ? diag.niveau : "ok",
      texte: diag ? (diag.code === "ECART_NEGATIF" ? "Écart négatif" : "Écart au-dessus du seuil") : "Écart sous le seuil",
      valeur: pourcent(res.ecart.ecartRelatif),
    });
    if (res.ecart.nonAttribueKwh > 0) {
      liste.push({ niveau: "info", texte: `${kwh(res.ecart.nonAttribueKwh)} kWh sans occupant, dans l'écart` });
    }
  }

  for (const m of analyse.manquants.filter((x) => x.section !== "releves")) {
    liste.push({ niveau: "erreur", texte: m.message });
  }
  for (const d of res?.diagnostics ?? []) {
    if (CODES_RESUMES.has(d.code) || d.code === "CONSOMMATION_NON_ATTRIBUEE") continue;
    liste.push({ niveau: d.niveau, texte: d.message });
  }
  return liste;
}

interface Props {
  brouillon: BrouillonCycle;
  analyse: Analyse;
  modifier: (m: (b: BrouillonCycle) => void) => void;
  calculer: () => void;
}

export function PanneauControle({ brouillon, analyse, modifier, calculer }: Props) {
  const res = analyse.resultat;
  const ecart = res?.ecart;
  const diagnostics: Diagnostic[] = res?.diagnostics ?? [];
  const factureEnCause = diagnostics.some((d) => d.code === "FACTURE_INCOHERENTE");
  const ecartEnCause = diagnostics.some((d) => d.code === "ECART_ELEVE" || d.code === "ECART_NEGATIF");
  const relatif = ecart?.ecartRelatif ?? 0;
  const horsSeuil = relatif > 0.1 || relatif < -0.02;

  return (
    <aside className="pj-panneau" id="controle">
      <div className="pj-panneau-tete pj-libelle">
        <span>04 / Contrôle</span>
        <span>En direct</span>
      </div>
      <div className="pj-panneau-corps">
        <div>
          <div className="pj-cle-valeur">
            <span>Compteur JIRAMA</span>
            <span className="pj-num">{analyse.kwhFactures !== null ? `${kwh(analyse.kwhFactures)} kWh` : "—"}</span>
          </div>
          <div className="pj-cle-valeur">
            <span>Σ participants</span>
            <span className="pj-num">{ecart ? `− ${kwh(ecart.sommeParticipantsKwh)} kWh` : "—"}</span>
          </div>
          <div className="pj-cle-valeur somme">
            <span>Écart</span>
            <span className="pj-num">{ecart ? `${kwh(ecart.ecartKwh)} kWh · ${pourcent(relatif)}` : "—"}</span>
          </div>
          <div className="pj-jauge" aria-hidden>
            <div
              className="remplissage"
              data-alerte={horsSeuil || undefined}
              style={{ width: `${(Math.min(Math.max(relatif, 0), 0.2) / 0.2) * 100}%` }}
            />
            <div className="seuil" />
          </div>
          <div className="pj-jauge-legende pj-num">
            <span>0 %</span>
            <span>seuil 10 %</span>
            <span>20 %</span>
          </div>
        </div>

        <div className="pj-verifs">
          {verifications(brouillon, analyse).map((v, i) => (
            <div key={i}>
              <span className="ic" data-niveau={v.niveau}>
                {ICONES[v.niveau]}
              </span>
              <span>{v.texte}</span>
              {v.valeur && <span className="val pj-num">{v.valeur}</span>}
            </div>
          ))}
        </div>

        {(factureEnCause || brouillon.parametres.forcerFacture) && (
          <Checkbox
            label="Accepter la facture saisie telle quelle (la différence sera répartie au prorata)"
            checked={brouillon.parametres.forcerFacture}
            onChange={(e) => {
              const v = e.currentTarget.checked;
              modifier((b) => void (b.parametres.forcerFacture = v));
            }}
          />
        )}
        {(ecartEnCause || brouillon.parametres.forcerEcart) && (
          <Checkbox
            label="J'ai vérifié les relevés : accepter cet écart"
            checked={brouillon.parametres.forcerEcart}
            onChange={(e) => {
              const v = e.currentTarget.checked;
              modifier((b) => void (b.parametres.forcerEcart = v));
            }}
          />
        )}

        <Button fullWidth disabled={!res?.ok} onClick={calculer}>
          {res?.ok ? "Calculer la répartition →" : "Corrigez les erreurs"}
        </Button>
      </div>
    </aside>
  );
}

export function BarreMobile({ analyse, calculer }: { analyse: Analyse; calculer: () => void }) {
  const res = analyse.resultat;
  const erreurs = (res?.diagnostics.filter((d) => d.niveau === "erreur").length ?? 0) + analyse.manquants.length;
  const avertissements = res?.diagnostics.filter((d) => d.niveau === "avertissement").length ?? 0;
  return (
    <div className="pj-barre-mobile">
      <div className="infos">
        <b>{res?.ecart ? `Écart ${kwh(res.ecart.ecartKwh)} kWh · ${pourcent(res.ecart.ecartRelatif)}` : "Saisie en cours"}</b>
        {res?.ok ? `${avertissements} avertissement(s) · prêt` : `${erreurs} point(s) à corriger`}
      </div>
      <Button variant="white" color="dark" disabled={!res?.ok} onClick={calculer}>
        Calculer →
      </Button>
    </div>
  );
}
