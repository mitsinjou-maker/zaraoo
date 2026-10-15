import type { ResultatCycle, ResultatParticipant } from "@partage-jirama/moteur";
import type { Content, TableCell, TDocumentDefinitions, TVirtualFileSystem } from "pdfmake/interfaces";
import { datesIntermediaires, relevesVides, type BrouillonCycle } from "../domaine/brouillon";
import { aPayer, dateFr, entier, kwh, montant, poids, pourcent } from "../domaine/format";
import type { FoyerAffiche } from "../domaine/repartition";

export interface ContexteFiches {
  brouillon: BrouillonCycle;
  resultat: ResultatCycle;
}

const ENCRE = "#111214";
const GRIS = "#55554f";
const TRAIT = "#cfcdc5";
const PAPIER = "#f2f1ec";

const libelle = (texte: string): Content => ({
  text: texte.toUpperCase(),
  fontSize: 8,
  characterSpacing: 1.2,
  color: GRIS,
  margin: [0, 12, 0, 4],
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
      paddingTop: () => 3,
      paddingBottom: () => 3,
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
    for (const d of datesIntermediaires(brouillon, id)) {
      const v = r.intermediaires[d];
      corps.push([id, "Déménagement", dateFr(d), { text: v != null ? entier(v) : "non relevé", alignment: "right" }]);
    }
    corps.push([id, "Fin de cycle", dateFr(r.dateFin ?? f.dateFin), { text: r.indexFin !== null ? entier(r.indexFin) : "—", alignment: "right" }]);
  }
  return {
    table: { headerRows: 1, widths: ["auto", "*", "auto", "auto"], body: corps },
    layout: {
      hLineWidth: (i: number) => (i === 1 ? 0.8 : 0.5),
      vLineWidth: () => 0,
      hLineColor: (i: number) => (i === 1 ? ENCRE : TRAIT),
      paddingTop: () => 3,
      paddingBottom: () => 3,
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
        { text: "PARTAGE JIRAMA", bold: true, fontSize: 11, characterSpacing: 1 },
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
              [{ text: "À PAYER", color: "#b9b8b0", fontSize: 8, characterSpacing: 1.2, margin: [10, 8, 10, 0] }],
              [{ text: `${aPayer(p.totalArrondi)} Ar`, color: "#ffffff", fontSize: 20, bold: true, margin: [10, 0, 10, 0] }],
              [{ text: `${kwh(p.prixMoyenKwh)} Ar/kWh en moyenne`, color: "#b9b8b0", fontSize: 8.5, margin: [10, 0, 10, 8] }],
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
        body: [[{ text: "À payer (arrondi)", bold: true }, { text: `${aPayer(p.totalArrondi)} Ar`, bold: true, alignment: "right" }]],
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
    {
      margin: [0, 8, 0, 0],
      text: [
        { text: "Pour comparaison : ", bold: true },
        `avec votre propre compteur JIRAMA, vos ${kwh(p.kwhMesures)} kWh auraient coûté ${montant(p.totalSiCompteurIndividuel)} Ar `,
        { text: "(frais fixes complets, sans partage).", color: GRIS },
      ],
      fontSize: 8.5,
    },

    libelle("Comment est calculée votre part ?"),
    {
      ul: [
        `L'écart entre le compteur JIRAMA et les sous-compteurs (${kwh(ecart.ecartKwh)} kWh, ${pourcent(ecart.ecartRelatif)}) est ${
          ecart.mode === "egal" ? "partagé à parts égales selon les jours de présence" : "retiré proportionnellement à chaque consommation"
        }.`,
        "Chaque foyer a droit à la même part de chaque tranche par jour de présence. Les tranches chères ne sont payées que par la consommation qui dépasse cette part : votre montant ne dépend pas de ceux qui consomment plus que vous.",
        "Les taxes suivent le montant de l'énergie. La redevance, la prime fixe et l'exonération de TVA sont partagées selon les jours de présence.",
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
    info: { title: `Fiches ${ctx.brouillon.facture.mois}`, creator: "Partage JIRAMA" },
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
