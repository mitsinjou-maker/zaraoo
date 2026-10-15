import type { BrouillonCycle } from "./brouillon";
import type { CycleValide } from "./cycles";
import { bilanRegularisation } from "./regularisation";
import type { Reglages } from "./reglages";

/** Sauvegarde complète : tous les cycles validés et le cycle en cours, réimportables tels quels. */
export interface Sauvegarde {
  application: "zaraoo";
  version: 1;
  exporteLe: string;
  cycles: CycleValide[];
  brouillon: BrouillonCycle | null;
  /** Grilles tarifaires et règles de répartition. */
  reglages: Reglages | null;
}

export function sauvegarde(
  cycles: CycleValide[],
  brouillon: BrouillonCycle | null,
  maintenant = new Date(),
  reglages: Reglages | null = null,
): Sauvegarde {
  return {
    application: "zaraoo",
    version: 1,
    exporteLe: maintenant.toISOString(),
    cycles: [...cycles].sort((a, b) => a.dateFin.localeCompare(b.dateFin)),
    brouillon,
    reglages,
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
    "Facture estimée",
    "Déjà payé sur facture estimée (Ar)",
    "Net à payer (Ar)",
  ];
  const lignes = [...cycles]
    .sort((a, b) => a.dateFin.localeCompare(b.dateFin))
    .flatMap((c) => {
      const bilan = bilanRegularisation(c.brouillon, c.resultat);
      return c.resultat.participants.map((p) => {
        const regul = bilan?.parFoyer.get(p.occupantId);
        return [
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
          c.estimee ? "oui" : "non",
          nombre(regul?.credit ?? 0, 2),
          nombre(regul?.net ?? p.totalArrondi, 2),
        ].map(cellule);
      });
    });
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
