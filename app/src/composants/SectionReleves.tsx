import { Badge } from "@mantine/core";
import type { Diagnostic } from "@partage-jirama/moteur";
import {
  datesIntermediaires,
  relevesVides,
  type Analyse,
  type BrouillonCycle,
  type Logement,
  type RelevesSaisis,
} from "../domaine/brouillon";
import { dateFr, kwh } from "../domaine/format";
import { ChampDate, ChampNombre } from "./Champs";
import { PastilleLogement, Section } from "./Section";

interface Props {
  brouillon: BrouillonCycle;
  analyse: Analyse;
  modifier: (m: (b: BrouillonCycle) => void) => void;
}

export function SectionReleves({ brouillon, analyse, modifier }: Props) {
  const dateFin = brouillon.facture.dateFin;
  return (
    <Section
      id="releves"
      numero="03"
      titre="Relevés des sous-compteurs"
      actions={dateFin ? <Badge color="blue">Relever le {dateFr(dateFin)} · tolérance ±1 j</Badge> : undefined}
    >
      {brouillon.logements.length === 0 && <p className="pj-aide">Ajoutez d'abord un logement (section 02).</p>}
      {brouillon.logements.map((l) => (
        <BlocCompteur key={l.id} logement={l} brouillon={brouillon} analyse={analyse} modifier={modifier} />
      ))}
    </Section>
  );
}

interface Ligne {
  cle: string;
  qui: string;
  detail: string;
  date: string | null;
  index: number | null;
  /** Date modifiable (relevé de fin uniquement). */
  dateModifiable?: boolean;
  obligatoire: boolean;
  enregistrer: (r: RelevesSaisis, v: number | null) => void;
}

function BlocCompteur({ logement, brouillon, analyse, modifier }: Props & { logement: Logement }) {
  const f = brouillon.facture;
  const r = brouillon.releves[logement.id] ?? relevesVides();
  const occupations = analyse.occupations.filter((o) => o.occupation.logementId === logement.id).map((o) => o.occupation);
  const vide = occupations.length === 0;
  const finDeCycle = f.dateFin;
  const presentsALaFin = occupations.filter((o) => o.sortie === null || (finDeCycle !== null && o.sortie >= finDeCycle));

  const lignes: Ligne[] = [
    {
      cle: "debut",
      qui: "Index de début",
      detail: "Relevé de fin du cycle précédent",
      date: f.dateDebut,
      index: r.indexDebut,
      obligatoire: true,
      enregistrer: (x, v) => void (x.indexDebut = v),
    },
    ...datesIntermediaires(brouillon, logement.id).map((d): Ligne => {
      const partants = occupations.filter((o) => o.sortie === d).map((o) => `départ de ${o.nom}`);
      const arrivants = occupations.filter((o) => o.entree === d).map((o) => `arrivée de ${o.nom}`);
      return {
        cle: d,
        qui: "Déménagement",
        detail: [...partants, ...arrivants].join(" · ") || "changement d'occupant",
        date: d,
        index: r.intermediaires[d] ?? null,
        obligatoire: false,
        enregistrer: (x, v) => void (x.intermediaires[d] = v),
      };
    }),
    {
      cle: "fin",
      qui: presentsALaFin.map((o) => o.nom).join(", ") || "Aucun occupant",
      detail: vide ? "Consommation comptée dans l'écart" : "Fin de cycle",
      date: r.dateFin ?? f.dateFin,
      dateModifiable: true,
      index: r.indexFin,
      obligatoire: true,
      enregistrer: (x, v) => void (x.indexFin = v),
    },
  ];

  // Consommation de chaque ligne depuis le dernier index connu, et contrôle des index en baisse.
  let precedent: { index: number; date: string | null } | null = null;
  const consos = lignes.map((l) => {
    if (l.index === null) return { kwh: null as number | null, depuis: null as string | null, enBaisse: false };
    const res = precedent
      ? { kwh: l.index - precedent.index, depuis: precedent.date, enBaisse: l.index < precedent.index }
      : { kwh: null, depuis: null, enBaisse: false };
    precedent = { index: l.index, date: l.date };
    return res;
  });
  const total = r.indexDebut !== null && r.indexFin !== null ? r.indexFin - r.indexDebut : null;

  const diagnostics: Diagnostic[] = (analyse.resultat?.diagnostics ?? []).filter((d) => d.logementId === logement.id);
  const manquants = analyse.manquants.filter((m) => m.logementId === logement.id);
  const enBaisse = consos.some((c) => c.enBaisse);

  return (
    <div className="pj-compteur" data-vide={vide || undefined}>
      <div className="pj-compteur-tete">
        <PastilleLogement id={logement.id} couleur={logement.couleur} />
        <h4>{vide ? "Logement vide" : occupations.map((o) => o.nom).join(" → ")}</h4>
        {(logement.nom || logement.numeroCompteur) && (
          <span className="pj-gris" style={{ fontSize: 12.5 }}>
            {[logement.nom, logement.numeroCompteur && `compteur ${logement.numeroCompteur}`].filter(Boolean).join(" · ")}
          </span>
        )}
        {occupations.length > 1 && <Badge color="orange">Déménagement</Badge>}
        {vide && <Badge color="gray">Vide</Badge>}
        <span className="pj-num pj-gris" style={{ marginLeft: "auto" }}>
          {total !== null && total >= 0 ? `Total ${kwh(total)} kWh` : ""}
        </span>
      </div>

      {lignes.map((l, i) => {
        const c = consos[i];
        return (
          <div className="pj-ligne-releve" key={l.cle}>
            <div className="qui">
              {l.qui}
              <small>{l.detail}</small>
            </div>
            {l.dateModifiable ? (
              <ChampDate
                label="Date"
                valeur={l.date}
                onValeur={(v) => modifier((b) => void ((b.releves[logement.id] ??= relevesVides()).dateFin = v))}
              />
            ) : (
              <div>
                <div className="pj-label-champ">Date</div>
                <div className="pj-calcule" style={{ fontWeight: 400 }}>
                  {dateFr(l.date)}
                </div>
              </div>
            )}
            <ChampNombre
              label="Index"
              placeholder={l.obligatoire ? undefined : "facultatif"}
              valeur={l.index}
              onValeur={(v) => modifier((b) => l.enregistrer((b.releves[logement.id] ??= relevesVides()), v))}
              error={c.enBaisse ? "Index en baisse" : undefined}
              styles={{ input: { textAlign: "right" } }}
            />
            <div className="conso">
              {c.kwh !== null && !c.enBaisse ? (
                <>
                  <b>{kwh(c.kwh)}</b>
                  <small>kWh depuis le {dateFr(c.depuis)}</small>
                </>
              ) : (
                <small>{i === 0 ? "" : "—"}</small>
              )}
            </div>
          </div>
        );
      })}

      <div className="pj-compteur-pied">
        <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {enBaisse && <Badge color="red">Index en baisse</Badge>}
          {manquants.map((m) => (
            <Badge key={m.message} color="red">
              {m.message.replace(`${logement.id} : `, "")}
            </Badge>
          ))}
          {diagnostics
            .filter((d) => d.code !== "INDEX_EN_BAISSE")
            .map((d) => (
              <Badge key={d.code + d.message} color={d.niveau === "erreur" ? "red" : d.niveau === "avertissement" ? "orange" : "gray"}>
                {libelleDiagnostic(d)}
              </Badge>
            ))}
          {!enBaisse && manquants.length === 0 && diagnostics.length === 0 && <Badge color="green">OK</Badge>}
        </span>
      </div>
    </div>
  );
}

function libelleDiagnostic(d: Diagnostic): string {
  switch (d.code) {
    case "RELEVE_DATE_DECALEE":
      return d.niveau === "info" ? "Date décalée · tolérée" : "Date trop éloignée de la facture";
    case "CONSOMMATION_ESTIMEE":
      return "Consommation estimée (pas de relevé)";
    case "CONSOMMATION_NON_ATTRIBUEE":
      return "Consommation sans occupant → écart";
    default:
      return d.message;
  }
}
