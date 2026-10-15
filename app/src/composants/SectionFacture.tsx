import { Badge, Checkbox, SimpleGrid, Table, TextInput } from "@mantine/core";
import type { Analyse, BrouillonCycle } from "../domaine/brouillon";
import { entier, kwh, montant } from "../domaine/format";
import { ChampDate, ChampNombre } from "./Champs";
import { Section } from "./Section";

const COULEURS_TRANCHES = ["var(--t1)", "var(--t2)", "var(--t3)", "var(--t4)"];

interface Props {
  brouillon: BrouillonCycle;
  analyse: Analyse;
  modifier: (m: (b: BrouillonCycle) => void) => void;
}

export function SectionFacture({ brouillon, analyse, modifier }: Props) {
  const f = brouillon.facture;
  const t = brouillon.tarif;
  const calcul = analyse.facture;
  const coef = f.coefficientTranche ?? 1;
  const indexEnBaisse = analyse.kwhFactures !== null && analyse.kwhFactures < 0;

  const difference = calcul && f.totalSaisi !== null ? Math.round((f.totalSaisi - calcul.total) * 100) / 100 : null;
  const coherent = difference !== null && Math.abs(difference) <= 1;

  const regle = (i: number) => {
    const plafond = t.tranches[i].plafondKwh;
    const precedent = i === 0 ? 0 : t.tranches[i - 1].plafondKwh;
    if (i === t.tranches.length - 1) return `au-delà de ${entier((precedent ?? 0) * coef)} kWh`;
    return `${i === 0 ? 0 : entier((precedent ?? 0) * coef + 1)} – ${entier((plafond ?? 0) * coef)} kWh`;
  };
  const valeur = (n: number | undefined) => (n === undefined ? "—" : montant(n));

  return (
    <Section
      id="facture"
      numero="01"
      titre="Facture JIRAMA"
      actions={f.estimee ? <Badge color="orange">Facture estimée</Badge> : undefined}
    >
      <div className="pj-sous-titre pj-libelle">Compteur principal</div>
      <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md" verticalSpacing="sm">
        <TextInput
          label="N° de facture"
          value={f.numero}
          onChange={(e) => {
            const v = e.currentTarget.value;
            modifier((b) => void (b.facture.numero = v));
          }}
        />
        <TextInput
          label="Mois facturé"
          value={f.mois}
          onChange={(e) => {
            const v = e.currentTarget.value;
            modifier((b) => void (b.facture.mois = v));
          }}
        />
        <ChampNombre
          label="Coeff. de tranche"
          valeur={f.coefficientTranche}
          onValeur={(v) => modifier((b) => void (b.facture.coefficientTranche = v))}
          styles={{ input: { textAlign: "right" } }}
        />
        <ChampNombre
          label="Puissance souscrite (kW)"
          valeur={f.puissanceKw}
          onValeur={(v) => modifier((b) => void (b.facture.puissanceKw = v))}
          styles={{ input: { textAlign: "right" } }}
        />
        <ChampDate
          label="Date ancien index"
          valeur={f.dateDebut}
          onValeur={(v) => modifier((b) => void (b.facture.dateDebut = v))}
        />
        <ChampNombre
          label="Ancien index"
          valeur={f.indexDebut}
          onValeur={(v) => modifier((b) => void (b.facture.indexDebut = v))}
          styles={{ input: { textAlign: "right" } }}
        />
        <ChampDate
          label="Date nouvel index"
          valeur={f.dateFin}
          onValeur={(v) => modifier((b) => void (b.facture.dateFin = v))}
        />
        <ChampNombre
          label="Nouvel index"
          valeur={f.indexFin}
          onValeur={(v) => modifier((b) => void (b.facture.indexFin = v))}
          error={indexEnBaisse ? "Inférieur à l'ancien index" : undefined}
          styles={{ input: { textAlign: "right" } }}
        />
        <div style={{ gridColumn: "span 2" }}>
          <div className="pj-label-champ">Consommation facturée</div>
          <div className="pj-calcule">
            {analyse.kwhFactures !== null && !indexEnBaisse ? `${entier(analyse.kwhFactures)} kWh` : "—"}
            {analyse.joursCycle !== null && analyse.joursCycle > 0 ? ` · ${analyse.joursCycle} jours` : ""}
          </div>
        </div>
        <div style={{ gridColumn: "span 2" }}>
          <div className="pj-label-champ">Type de facture</div>
          <Checkbox
            mt={8}
            label="Facture estimée (marquée « E »)"
            checked={f.estimee}
            onChange={(e) => {
              const v = e.currentTarget.checked;
              modifier((b) => void (b.facture.estimee = v));
            }}
          />
        </div>
      </SimpleGrid>

      <div className="pj-sous-titre pj-libelle">
        <span>Lignes de la facture</span>
        <Badge color="gray">{t.nom} · à vérifier avec les prix imprimés</Badge>
      </div>
      <div className="pj-tableau">
        <Table verticalSpacing={6} horizontalSpacing="sm" miw={560}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Ligne</Table.Th>
              <Table.Th className="pj-cacher-mobile">Règle</Table.Th>
              <Table.Th w={130}>Prix / taux</Table.Th>
              <Table.Th className="r">kWh / base</Table.Th>
              <Table.Th className="r">Montant recalculé</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {t.tranches.map((tr, i) => (
              <Table.Tr key={`t${i}`}>
                <Table.Td>
                  <span className="pj-carre" style={{ background: COULEURS_TRANCHES[i % 4] }} />
                  {i + 1}
                  {i === 0 ? "ère" : "ème"} tranche
                </Table.Td>
                <Table.Td className="pj-gris pj-cacher-mobile">{regle(i)}</Table.Td>
                <Table.Td>
                  <ChampNombre
                    size="xs"
                    valeur={tr.prixKwh}
                    onValeur={(v) => modifier((b) => void (b.tarif.tranches[i].prixKwh = v))}
                    styles={{ input: { textAlign: "right" } }}
                  />
                </Table.Td>
                <Table.Td className="r pj-num">{calcul ? kwh(calcul.tranches[i].kwh) : "—"}</Table.Td>
                <Table.Td className="r pj-num">{valeur(calcul?.tranches[i].montant)}</Table.Td>
              </Table.Tr>
            ))}
            {t.fraisFixes.map((ff, i) => (
              <Table.Tr key={`f${i}`}>
                <Table.Td>{ff.libelle}</Table.Td>
                <Table.Td className="pj-gris pj-cacher-mobile">{ff.parKw ? "prix × puissance souscrite" : "montant fixe"}</Table.Td>
                <Table.Td>
                  <ChampNombre
                    size="xs"
                    valeur={ff.prixUnitaire}
                    onValeur={(v) => modifier((b) => void (b.tarif.fraisFixes[i].prixUnitaire = v))}
                    styles={{ input: { textAlign: "right" } }}
                  />
                </Table.Td>
                <Table.Td className="r pj-num">{ff.parKw && f.puissanceKw !== null ? `× ${kwh(f.puissanceKw)} kW` : "—"}</Table.Td>
                <Table.Td className="r pj-num">{valeur(calcul?.fraisFixes[i].montant)}</Table.Td>
              </Table.Tr>
            ))}
            {t.taxes.map((tx, i) => (
              <Table.Tr key={`x${i}`}>
                <Table.Td>{tx.libelle}</Table.Td>
                <Table.Td className="pj-gris pj-cacher-mobile">% de l'énergie</Table.Td>
                <Table.Td>
                  <ChampNombre
                    size="xs"
                    suffix=" %"
                    valeur={tx.tauxPourcent}
                    onValeur={(v) => modifier((b) => void (b.tarif.taxes[i].tauxPourcent = v))}
                    styles={{ input: { textAlign: "right" } }}
                  />
                </Table.Td>
                <Table.Td className="r pj-num">{valeur(calcul?.energie)}</Table.Td>
                <Table.Td className="r pj-num">{valeur(calcul?.taxes[i].montant)}</Table.Td>
              </Table.Tr>
            ))}
            <Table.Tr>
              <Table.Td>TVA</Table.Td>
              <Table.Td className="pj-gris pj-cacher-mobile">franchise {t.franchiseKwh} kWh × prix T1</Table.Td>
              <Table.Td>
                <ChampNombre
                  size="xs"
                  suffix=" %"
                  valeur={t.tvaPourcent}
                  onValeur={(v) => modifier((b) => void (b.tarif.tvaPourcent = v))}
                  styles={{ input: { textAlign: "right" } }}
                />
              </Table.Td>
              <Table.Td className="r pj-num">{valeur(calcul?.baseTva)}</Table.Td>
              <Table.Td className="r pj-num">{valeur(calcul?.tva)}</Table.Td>
            </Table.Tr>
            <Table.Tr className="total">
              <Table.Td>Total (3)</Table.Td>
              <Table.Td className="pj-cacher-mobile" />
              <Table.Td />
              <Table.Td />
              <Table.Td className="r pj-num">{valeur(calcul?.total)}</Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </div>

      <div className="pj-controle-total">
        <div>
          <ChampNombre
            label="Total imprimé sur la facture"
            decimalScale={2}
            fixedDecimalScale
            valeur={f.totalSaisi}
            onValeur={(v) => modifier((b) => void (b.facture.totalSaisi = v))}
            error={difference !== null && !coherent}
            styles={{ input: { textAlign: "right" } }}
          />
        </div>
        <div>
          <span className="pj-label-champ">Total recalculé</span>
          <span className="v">{valeur(calcul?.total)}</span>
        </div>
        <div>
          <span className="pj-label-champ">Différence</span>
          {difference === null ? (
            <span className="v">—</span>
          ) : (
            <>
              <span className={`v ${coherent ? "pj-ok" : "pj-erreur"}`}>
                {difference > 0 ? "+" : ""}
                {montant(difference)}
              </span>
              <span className="pj-aide">
                {coherent ? "✓ Facture cohérente" : "Vérifiez les prix, la puissance ou une ligne oubliée"}
              </span>
            </>
          )}
        </div>
      </div>
    </Section>
  );
}
