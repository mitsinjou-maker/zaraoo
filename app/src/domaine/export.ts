import type { BrouillonCycle } from "./brouillon";
import type { CycleValide } from "./cycles";

/** Sauvegarde complète : tous les cycles validés et le cycle en cours, réimportables tels quels. */
export interface Sauvegarde {
  application: "partage-jirama";
  version: 1;
  exporteLe: string;
  cycles: CycleValide[];
  brouillon: BrouillonCycle | null;
}

export function sauvegarde(cycles: CycleValide[], brouillon: BrouillonCycle | null, maintenant = new Date()): Sauvegarde {
  return {
    application: "partage-jirama",
    version: 1,
    exporteLe: maintenant.toISOString(),
    cycles: [...cycles].sort((a, b) => a.dateFin.localeCompare(b.dateFin)),
    brouillon,
  };
}

const nombre = (n: number, decimales: number) => n.toFixed(decimales).replace(".", ",");
const cellule = (v: string) => (/[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const date = (iso: string) => iso.split("-").reverse().join("/");

/**
 * Tableau pour Excel : une ligne par foyer et par cycle. Séparateur « ; » et virgule décimale
 * (réglages français d'Excel), précédé d'un BOM pour que les accents s'affichent correctement.
 */
export function tableauCsv(cycles: CycleValide[]): string {
  const entetes = [
    "Mois",
    "Du",
    "Au",
    "Facture JIRAMA (Ar)",
    "Foyer",
    "Logements",
    "Jours",
    "kWh mesurés",
    "Part de l'écart (kWh)",
    "kWh retenus",
    "Énergie (Ar)",
    "Taxes (Ar)",
    "Frais fixes (Ar)",
    "TVA (Ar)",
    "À payer (Ar)",
    "Estimé",
    "Validé le",
  ];
  const lignes = [...cycles]
    .sort((a, b) => a.dateFin.localeCompare(b.dateFin))
    .flatMap((c) =>
      c.resultat.participants.map((p) =>
        [
          c.mois,
          date(c.dateDebut),
          date(c.dateFin),
          nombre(c.totalFacture, 2),
          p.nom ?? p.occupantId,
          p.logementIds.join(" "),
          String(p.jours),
          nombre(p.kwhMesures, 2),
          nombre(p.partEcartKwh, 2),
          nombre(p.kwhCorriges, 2),
          nombre(p.energie, 2),
          nombre(p.totalTaxes, 2),
          nombre(p.totalFraisFixes, 2),
          nombre(p.tva, 2),
          nombre(p.totalArrondi, 2),
          p.estime ? "oui" : "non",
          date(c.valideLe.slice(0, 10)),
        ].map(cellule),
      ),
    );
  return "﻿" + [entetes.map(cellule), ...lignes].map((l) => l.join(";")).join("\r\n") + "\r\n";
}

/** Fait télécharger un fichier par le navigateur. */
export function telecharger(nomFichier: string, contenu: string, type: string): void {
  const url = URL.createObjectURL(new Blob([contenu], { type }));
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
