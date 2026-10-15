import type { ResultatCycle, ResultatParticipant } from "@partage-jirama/moteur";
import type { Content, TableCell, TDocumentDefinitions, TVirtualFileSystem } from "pdfmake/interfaces";
import { datesIntermediaires, relevesVides, type BrouillonCycle } from "../domaine/brouillon";
import { aPayer, dateFr, entier, kwh, montant, poids, pourcent } from "../domaine/format";
import type { BilanRegularisation } from "../domaine/regularisation";
import type { FoyerAffiche } from "../domaine/repartition";

export interface ContexteFiches {
  brouillon: BrouillonCycle;
  resultat: ResultatCycle;
  /** Cycle de régularisation d'une facture estimée. */
  bilan?: BilanRegularisation | null;
}

const ENCRE = "#111214";
const GRIS = "#55554f";
const TRAIT = "#cfcdc5";
const PAPIER = "#f2f1ec";

/** Mise en page resserrée pour les fiches longues (remplacement de compteur, régularisation) : une page par foyer. */
let serre = false;
/** Marge des cellules, fixée à la construction de la fiche (pdfmake n'appelle ces fonctions qu'au rendu). */
const marge = () => {
  const m = serre ? 2 : 3;
  return () => m;
};

const libelle = (texte: string): Content => ({
  text: texte.toUpperCase(),
  fontSize: 8,
  characterSpacing: 1.2,
  color: GRIS,
  margin: serre ? [0, 9, 0, 3] : [0, 12, 0, 4],
});

/** Tableau à deux colonnes « libellé · montant ». */
function lignes(rangees: [string, string, boolean?][]): Content {
  return {
    table: {
      widths: ["*", "auto"],
      body: rangees.map(([g, d, fort]) => [
        { text: g, color: fort ? ENCRE : GRIS, bold: !!fort },
        { text: d, alignment: "right", bold: !!fort },
      ]),
    },
    layout: {
      hLineWidth: (i: number, node: { table: { body: unknown[] } }) => (i === 0 || i === node.table.body.length ? 0 : 0.5),
      vLineWidth: () => 0,
      hLineColor: () => TRAIT,
      paddingTop: marge(),
      paddingBottom: marge(),
      paddingLeft: () => 0,
      paddingRight: () => 0,
    },
  };
}

function relevesDuFoyer(ctx: ContexteFiches, p: ResultatParticipant): Content {
  const { brouillon } = ctx;
  const f = brouillon.facture;
  const corps: TableCell[][] = [
    [
      { text: "Logement", style: "th" },
      { text: "Relevé", style: "th" },
      { text: "Date", style: "th" },
      { text: "Index", style: "th", alignment: "right" },
    ],
  ];
  for (const id of p.logementIds) {
    const r = brouillon.releves[id] ?? relevesVides();
    corps.push([id, "Début de cycle", dateFr(f.dateDebut), { text: r.indexDebut !== null ? entier(r.indexDebut) : "—", alignment: "right" }]);
    const milieu: { date: string; ligne: TableCell[] }[] = datesIntermediaires(brouillon, id).map((d) => {
      const v = r.intermediaires[d];
      return { date: d, ligne: [id, "Déménagement", dateFr(d), { text: v != null ? entier(v) : "non relevé", alignment: "right" }] };
    });
    const rem = r.remplacement;
    if (rem?.date) {
      milieu.push(
        { date: rem.date, ligne: [id, "Ancien compteur, déposé", dateFr(rem.date), { text: rem.indexAncien !== null ? entier(rem.indexAncien) : "—", alignment: "right" }] },
        { date: rem.date, ligne: [id, "Nouveau compteur, posé", dateFr(rem.date), { text: rem.indexNouveau !== null ? entier(rem.indexNouveau) : "—", alignment: "right" }] },
      );
    }
    // Tri stable : à date égale, la dépose précède la pose.
    for (const m of milieu.sort((a, b) => a.date.localeCompare(b.date))) corps.push(m.ligne);
    corps.push([id, "Fin de cycle", dateFr(r.dateFin ?? f.dateFin), { text: r.indexFin !== null ? entier(r.indexFin) : "—", alignment: "right" }]);
  }
  return {
    table: { headerRows: 1, widths: ["auto", "*", "auto", "auto"], body: corps },
    layout: {
      hLineWidth: (i: number) => (i === 1 ? 0.8 : 0.5),
      vLineWidth: () => 0,
      hLineColor: (i: number) => (i === 1 ? ENCRE : TRAIT),
      paddingTop: marge(),
      paddingBottom: marge(),
    },
  };
}

function fiche(ctx: ContexteFiches, foyer: FoyerAffiche, premiere: boolean): Content[] {
  const { brouillon, resultat } = ctx;
  const p = foyer.participant;
  const f = resultat.facture!;
  const ecart = resultat.ecart!;
  const nom = p.nom ?? p.occupantId;
  const mois = brouillon.facture.mois || "Cycle";
  const tauxTva = brouillon.tarif.tvaPourcent ?? 0;
  // Cycle de régularisation : on déduit ce que le foyer a déjà payé sur la facture estimée.
  const regul = ctx.bilan?.parFoyer.get(p.occupantId);
  serre = regul !== undefined || p.logementIds.some((id) => brouillon.releves[id]?.remplacement);
  const aPayerFinal = regul ? regul.net : p.totalArrondi;
  const lignesAPayer: TableCell[][] = [
    [
      { text: regul ? "Votre part (arrondie)" : "À payer (arrondi)", bold: true },
      { text: `${aPayer(p.totalArrondi)} Ar`, bold: true, alignment: "right" },
    ],
  ];
  if (regul && ctx.bilan) {
    lignesAPayer.push(
      [
        { text: `Déjà payé sur la facture estimée de ${ctx.bilan.regularisation.mois}`, color: GRIS },
        { text: `− ${aPayer(regul.credit)} Ar`, alignment: "right" },
      ],
      [
        { text: regul.net < 0 ? "À vous rembourser" : "Net à payer", bold: true },
        { text: `${aPayer(Math.abs(regul.net))} Ar`, bold: true, alignment: "right" },
      ],
    );
  }

  const tranches: [string, string, boolean?][] = p.kwhParTranche
    .map((q, i): [string, string] => [`Tranche ${i + 1} : ${kwh(q)} kWh × ${entier(f.tranches[i].prixKwh)} Ar`, montant(q * f.tranches[i].prixKwh)])
    .filter((_, i) => p.kwhParTranche[i] > 0);

  const calcul: [string, string, boolean?][] = [
    ...tranches,
    ["Énergie", montant(p.energie), true],
    ...p.taxes.map((t): [string, string] => [t.libelle, montant(t.montant)]),
    ...p.fraisFixes.map((t): [string, string] => [`${t.libelle} (part du foyer)`, montant(t.montant)]),
    ["Montant avant TVA", montant(p.assietteTva), true],
    [`Exonération de TVA (part de la franchise du bâtiment)`, `− ${montant(p.franchiseTva)}`],
    [`TVA ${entier(tauxTva)} %`, montant(p.tva)],
    ...(Math.abs(p.ajustement) >= 0.005 ? [["Ajustement (facture acceptée telle quelle)", montant(p.ajustement)] as [string, string]] : []),
    ["Total calculé", montant(p.total)],
  ];

  return [
    {
      columns: [
        { text: "ZARAOO", bold: true, fontSize: 11, characterSpacing: 1 },
        { text: `FICHE DU FOYER · ${mois.toUpperCase()}`, alignment: "right", fontSize: 8, characterSpacing: 1.2, color: GRIS },
      ],
      pageBreak: premiere ? undefined : "before",
    },
    { canvas: [{ type: "line", x1: 0, y1: 6, x2: 515, y2: 6, lineWidth: 1, lineColor: ENCRE }] },
    {
      margin: [0, 12, 0, 0],
      columnGap: 16,
      columns: [
        {
          width: "*",
          stack: [
            { text: nom, fontSize: 22, bold: true, margin: [0, 4, 0, 2] },
            {
              text: `Logement ${p.logementIds.join(", ")} · présent ${p.jours} / ${resultat.joursCycle} jours (poids ${poids(p.poids)})${
                p.estime ? " · consommation estimée" : ""
              }`,
              color: GRIS,
            },
          ],
        },
        {
          width: 190,
          table: {
            widths: ["*"],
            body: [
              [
                {
                  text: aPayerFinal < 0 ? "À VOUS REMBOURSER" : regul ? "NET À PAYER" : "À PAYER",
                  color: "#b9b8b0",
                  fontSize: 8,
                  characterSpacing: 1.2,
                  margin: [10, 8, 10, 0],
                },
              ],
              [{ text: `${aPayer(Math.abs(aPayerFinal))} Ar`, color: "#ffffff", fontSize: 20, bold: true, margin: [10, 0, 10, 0] }],
              [
                {
                  text: regul ? `part ${aPayer(p.totalArrondi)} − déjà payé ${aPayer(regul.credit)}` : `${kwh(p.prixMoyenKwh)} Ar/kWh en moyenne`,
                  color: "#b9b8b0",
                  fontSize: 8.5,
                  margin: [10, 0, 10, 8],
                },
              ],
            ],
          },
          layout: { fillColor: () => ENCRE, hLineWidth: () => 0, vLineWidth: () => 0 },
        },
      ],
    },

    {
      columnGap: 24,
      columns: [
        [
          libelle("Facture du bâtiment"),
          lignes([
            ["Période", `du ${dateFr(brouillon.facture.dateDebut)} au ${dateFr(brouillon.facture.dateFin)}`],
            ["Facture JIRAMA", `${montant(resultat.controleFacture!.totalSaisi)} Ar`],
            ["Compteur JIRAMA", `${kwh(f.kwh)} kWh`],
            ["Foyers participants", String(resultat.participants.length)],
          ]),
        ],
        [
          libelle("Votre consommation"),
          lignes([
            ["Mesurée (sous-compteur)", `${kwh(p.kwhMesures)} kWh`],
            [
              ecart.mode === "egal" ? "Part de l'écart (communs, pertes)" : "Correction de l'écart",
              `${p.partEcartKwh >= 0 ? "+" : "−"} ${kwh(Math.abs(p.partEcartKwh))} kWh`,
            ],
            ["Consommation retenue", `${kwh(p.kwhCorriges)} kWh`, true],
          ]),
        ],
      ],
    },

    libelle("Relevés du sous-compteur"),
    relevesDuFoyer(ctx, p),

    libelle("Calcul de votre part"),
    lignes(calcul),
    {
      margin: [0, 4, 0, 0],
      table: {
        widths: ["*", "auto"],
        body: lignesAPayer,
      },
      layout: {
        hLineWidth: (i: number) => (i === 0 ? 1 : 0),
        vLineWidth: () => 0,
        hLineColor: () => ENCRE,
        paddingTop: () => 5,
        paddingLeft: () => 0,
        paddingRight: () => 0,
      },
    },
    // Sur une régularisation (deux périodes), la comparaison n'a guère de sens : la place sert au crédit.
    ...(regul
      ? []
      : [
          {
            margin: [0, 8, 0, 0],
            text: [
              { text: "Pour comparaison : ", bold: true },
              `avec votre propre compteur JIRAMA, vos ${kwh(p.kwhMesures)} kWh auraient coûté ${montant(p.totalSiCompteurIndividuel)} Ar `,
              { text: "(frais fixes complets, sans partage).", color: GRIS },
            ],
            fontSize: 8.5,
          } as Content,
        ]),

    libelle("Comment est calculée votre part ?"),
    {
      ul: [
        `L'écart entre le compteur JIRAMA et les sous-compteurs (${kwh(ecart.ecartKwh)} kWh, ${pourcent(ecart.ecartRelatif)}) est ${
          ecart.mode === "egal" ? "partagé à parts égales selon les jours de présence" : "retiré proportionnellement à chaque consommation"
        }.`,
        "Chaque foyer a droit à la même part de chaque tranche par jour de présence. Les tranches chères ne sont payées que par la consommation qui dépasse cette part : votre montant ne dépend pas de ceux qui consomment plus que vous.",
        "Les taxes suivent le montant de l'énergie. La redevance, la prime fixe et l'exonération de TVA sont partagées selon les jours de présence.",
        ...(ctx.bilan
          ? [
              `${ctx.bilan.regularisation.mois} avait été estimé par la JIRAMA : vous payez votre part réelle des deux périodes, moins ce que vous avez déjà payé.`,
            ]
          : []),
      ],
      fontSize: 8.5,
      color: GRIS,
    },
  ];
}

/** La police Roboto du PDF n'a pas l'espace fine insécable des nombres français : on la remplace. */
function nettoyer<T>(valeur: T): T {
  if (typeof valeur === "string") return valeur.replace(/[  ]/g, " ") as T;
  if (Array.isArray(valeur)) return valeur.map(nettoyer) as T;
  if (valeur && typeof valeur === "object") {
    return Object.fromEntries(Object.entries(valeur).map(([k, v]) => [k, typeof v === "function" ? v : nettoyer(v)])) as T;
  }
  return valeur;
}

export function documentFiches(ctx: ContexteFiches, foyers: FoyerAffiche[]): TDocumentDefinitions {
  const calculeLe = new Date().toLocaleDateString("fr-FR");
  return {
    pageSize: "A4",
    pageMargins: [40, 36, 40, 50],
    info: { title: `Fiches ${ctx.brouillon.facture.mois}`, creator: "Zaraoo" },
    defaultStyle: { font: "Roboto", fontSize: 9.5, color: ENCRE, lineHeight: 1.1 },
    styles: { th: { fontSize: 7.5, color: GRIS, characterSpacing: 1, fillColor: PAPIER } },
    content: nettoyer(foyers.flatMap((f, i) => fiche(ctx, f, i === 0))),
    footer: (page: number, total: number) =>
      nettoyer({
        margin: [40, 16, 40, 0],
        columns: [
          { text: `Calculé le ${calculeLe} · partage sériel, quotas égaux par jour de présence`, fontSize: 7.5, color: GRIS },
          { text: `${page} / ${total}`, alignment: "right", fontSize: 7.5, color: GRIS },
        ],
      }),
  };
}

function nomDeFichier(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

/** Crée le PDF des fiches (une page par foyer). pdfmake n'est chargé qu'à ce moment. */
export async function creerPdf(ctx: ContexteFiches, foyers: FoyerAffiche[]) {
  const [modulePdf, moduleVfs] = await Promise.all([import("pdfmake/build/pdfmake"), import("pdfmake/build/vfs_fonts")]);
  const pdfMake = (modulePdf as unknown as { default?: typeof modulePdf }).default ?? modulePdf;
  // vfs_fonts est un module CommonJS : selon l'outil, les polices sont dans `default` ou à la racine.
  const vfs = (moduleVfs.default ?? moduleVfs) as TVirtualFileSystem;
  pdfMake.addVirtualFileSystem(vfs);
  return pdfMake.createPdf(documentFiches(ctx, foyers));
}

/** Crée puis télécharge les fiches. */
export async function telechargerFiches(ctx: ContexteFiches, foyers: FoyerAffiche[]): Promise<void> {
  const pdf = await creerPdf(ctx, foyers);
  const mois = nomDeFichier(ctx.brouillon.facture.mois || "cycle");
  const nom =
    foyers.length === 1
      ? `fiche-${mois}-${nomDeFichier(foyers[0].participant.nom ?? foyers[0].participant.occupantId)}.pdf`
      : `fiches-${mois}.pdf`;
  await pdf.download(nom);
}
