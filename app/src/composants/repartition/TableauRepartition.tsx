import { Table } from "@mantine/core";
import type { ResultatCycle } from "@partage-jirama/moteur";
import { aPayer, kwh, montant } from "../../domaine/format";
import type { BilanRegularisation } from "../../domaine/regularisation";
import type { FoyerAffiche, LogementVide } from "../../domaine/repartition";
import { PastilleLogement } from "../Section";

interface Props {
  foyers: FoyerAffiche[];
  vides: LogementVide[];
  resultat: ResultatCycle;
  /** Vrai quand tous les foyers sont affichés : la ligne de total correspond alors à la facture. */
  complet: boolean;
  /** Cycle de régularisation : colonnes « Déjà payé » et « Net ». */
  bilan?: BilanRegularisation | null;
}

/** Vue « Tableau » : une ligne par foyer, totaux en bas. */
export function TableauRepartition({ foyers, vides, resultat, complet, bilan }: Props) {
  const nbTranches = resultat.facture?.tranches.length ?? 0;
  const net = (occupantId: string) => bilan?.parFoyer.get(occupantId);
  const t = resultat.totaux!;
  const e = resultat.ecart!;
  const somme = (f: (x: FoyerAffiche) => number) => foyers.reduce((s, x) => s + f(x), 0);

  return (
    <div className="pj-tableau pj-tableau-recap">
      <Table verticalSpacing={8} horizontalSpacing="sm" miw={1100}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Lgt</Table.Th>
            <Table.Th>Foyer</Table.Th>
            <Table.Th className="r">Jours</Table.Th>
            <Table.Th className="r">Mesuré</Table.Th>
            <Table.Th className="r">+ Écart</Table.Th>
            <Table.Th className="r">Corrigé</Table.Th>
            {Array.from({ length: nbTranches }, (_, i) => (
              <Table.Th key={i} className="r">
                T{i + 1}
              </Table.Th>
            ))}
            <Table.Th className="r">Énergie</Table.Th>
            <Table.Th className="r">Taxes</Table.Th>
            <Table.Th className="r">Fixes</Table.Th>
            <Table.Th className="r">Franchise</Table.Th>
            <Table.Th className="r">TVA</Table.Th>
            <Table.Th className="r">{bilan ? "Part" : "À payer"}</Table.Th>
            {bilan && (
              <>
                <Table.Th className="r">Déjà payé</Table.Th>
                <Table.Th className="r">Net</Table.Th>
              </>
            )}
            <Table.Th className="r">Ar/kWh</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {foyers.map(({ participant: p, logements }) => (
            <Table.Tr key={p.occupantId}>
              <Table.Td>
                {logements.map((l) => (
                  <PastilleLogement key={l.id} id={l.id} couleur={l.couleur} />
                ))}
              </Table.Td>
              <Table.Td className="nom">
                {p.nom ?? p.occupantId}
                {p.estime && <span className="pj-gris"> (estimé)</span>}
              </Table.Td>
              <Table.Td className="r">{p.jours}</Table.Td>
              <Table.Td className="r">{kwh(p.kwhMesures)}</Table.Td>
              <Table.Td className="r">{kwh(p.partEcartKwh)}</Table.Td>
              <Table.Td className="r">{kwh(p.kwhCorriges)}</Table.Td>
              {p.kwhParTranche.map((q, i) => (
                <Table.Td key={i} className="r">
                  {kwh(q)}
                </Table.Td>
              ))}
              <Table.Td className="r">{montant(p.energie)}</Table.Td>
              <Table.Td className="r">{montant(p.totalTaxes)}</Table.Td>
              <Table.Td className="r">{montant(p.totalFraisFixes)}</Table.Td>
              <Table.Td className="r">{montant(p.franchiseTva)}</Table.Td>
              <Table.Td className="r">{montant(p.tva)}</Table.Td>
              <Table.Td className="r" fw={bilan ? undefined : 700}>
                {aPayer(p.totalArrondi)}
              </Table.Td>
              {bilan && (
                <>
                  <Table.Td className="r">{aPayer(net(p.occupantId)?.credit ?? 0)}</Table.Td>
                  <Table.Td className="r" fw={700}>
                    {aPayer(net(p.occupantId)?.net ?? p.totalArrondi)}
                  </Table.Td>
                </>
              )}
              <Table.Td className="r">{kwh(p.prixMoyenKwh)}</Table.Td>
            </Table.Tr>
          ))}
          {vides.map((v) => (
            <Table.Tr key={v.logement.id} data-vide>
              <Table.Td>
                <PastilleLogement id={v.logement.id} couleur={v.logement.couleur} />
              </Table.Td>
              <Table.Td className="nom">Logement vide</Table.Td>
              <Table.Td className="r">0</Table.Td>
              <Table.Td className="r">{v.kwhReleves !== null ? `(${kwh(v.kwhReleves)})` : "—"}</Table.Td>
              <Table.Td colSpan={nbTranches + (bilan ? 11 : 9)} className="pj-gris">
                Consommation comptée dans l'écart
              </Table.Td>
            </Table.Tr>
          ))}
          {foyers.length > 0 && (
            <Table.Tr className="total">
              <Table.Td />
              <Table.Td>{complet ? "Total" : "Sous-total"}</Table.Td>
              <Table.Td />
              <Table.Td className="r">{kwh(complet ? e.sommeParticipantsKwh : somme((x) => x.participant.kwhMesures))}</Table.Td>
              <Table.Td className="r">{kwh(complet ? e.ecartKwh : somme((x) => x.participant.partEcartKwh))}</Table.Td>
              <Table.Td className="r">{kwh(complet ? t.kwh : somme((x) => x.participant.kwhCorriges))}</Table.Td>
              {Array.from({ length: nbTranches }, (_, i) => (
                <Table.Td key={i} className="r">
                  {kwh(somme((x) => x.participant.kwhParTranche[i]))}
                </Table.Td>
              ))}
              <Table.Td className="r">{montant(somme((x) => x.participant.energie))}</Table.Td>
              <Table.Td className="r">{montant(somme((x) => x.participant.totalTaxes))}</Table.Td>
              <Table.Td className="r">{montant(somme((x) => x.participant.totalFraisFixes))}</Table.Td>
              <Table.Td className="r">{montant(somme((x) => x.participant.franchiseTva))}</Table.Td>
              <Table.Td className="r">{montant(somme((x) => x.participant.tva))}</Table.Td>
              <Table.Td className="r">{aPayer(complet ? t.totalArrondi : somme((x) => x.participant.totalArrondi))}</Table.Td>
              {bilan && (
                <>
                  <Table.Td className="r">{aPayer(somme((x) => net(x.participant.occupantId)?.credit ?? 0))}</Table.Td>
                  <Table.Td className="r">
                    {aPayer(somme((x) => net(x.participant.occupantId)?.net ?? x.participant.totalArrondi))}
                  </Table.Td>
                </>
              )}
              <Table.Td />
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </div>
  );
}
