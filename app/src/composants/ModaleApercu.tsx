import { Modal, Table } from "@mantine/core";
import type { ResultatCycle } from "@partage-jirama/moteur";
import { kwh, montant } from "../domaine/format";

/** Aperçu provisoire du résultat, en attendant l'écran de répartition (maquette « répartition »). */
export function ModaleApercu({ resultat, fermer }: { resultat: ResultatCycle | null; fermer: () => void }) {
  const t = resultat?.totaux;
  return (
    <Modal opened={resultat !== null} onClose={fermer} title="Répartition du cycle — aperçu" size="xl">
      <p className="pj-aide" style={{ marginTop: 0 }}>
        Aperçu calculé par le moteur. L'écran complet de répartition (cartes, fiches PDF) est l'étape suivante.
      </p>
      <div className="pj-tableau">
        <Table verticalSpacing={6} horizontalSpacing="sm" miw={720}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Foyer</Table.Th>
              <Table.Th className="r">kWh</Table.Th>
              <Table.Th className="r">Énergie</Table.Th>
              <Table.Th className="r">Taxes</Table.Th>
              <Table.Th className="r">Fixes</Table.Th>
              <Table.Th className="r">TVA</Table.Th>
              <Table.Th className="r">À payer</Table.Th>
              <Table.Th className="r">Ar/kWh</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {resultat?.participants.map((p) => (
              <Table.Tr key={p.occupantId}>
                <Table.Td fw={700}>
                  {p.nom ?? p.occupantId}
                  {p.estime && <span className="pj-gris"> (estimé)</span>}
                </Table.Td>
                <Table.Td className="r pj-num">{kwh(p.kwhCorriges)}</Table.Td>
                <Table.Td className="r pj-num">{montant(p.energie)}</Table.Td>
                <Table.Td className="r pj-num">{montant(p.totalTaxes)}</Table.Td>
                <Table.Td className="r pj-num">{montant(p.totalFraisFixes)}</Table.Td>
                <Table.Td className="r pj-num">{montant(p.tva)}</Table.Td>
                <Table.Td className="r pj-num" fw={700}>
                  {montant(p.totalArrondi)}
                </Table.Td>
                <Table.Td className="r pj-num">{kwh(p.prixMoyenKwh)}</Table.Td>
              </Table.Tr>
            ))}
            {t && (
              <Table.Tr className="total">
                <Table.Td>Total</Table.Td>
                <Table.Td className="r pj-num">{kwh(t.kwh)}</Table.Td>
                <Table.Td className="r pj-num">{montant(t.energie)}</Table.Td>
                <Table.Td className="r pj-num">{montant(t.taxes)}</Table.Td>
                <Table.Td className="r pj-num">{montant(t.fraisFixes)}</Table.Td>
                <Table.Td className="r pj-num">{montant(t.tva)}</Table.Td>
                <Table.Td className="r pj-num">{montant(t.totalArrondi)}</Table.Td>
                <Table.Td />
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </div>
      {t && t.reliquatArrondi !== 0 && (
        <p className="pj-aide">
          Arrondi à l'Ariary : {montant(Math.abs(t.reliquatArrondi))} Ar {t.reliquatArrondi > 0 ? "non répartis" : "répartis en trop"} par
          rapport à la facture.
        </p>
      )}
    </Modal>
  );
}
