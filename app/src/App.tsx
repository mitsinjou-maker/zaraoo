import { calculerFacture, grilleTarif20Economique2022 } from "@partage-jirama/moteur";

// Écran provisoire : l'interface (Mantine, Firebase, PDF) arrive à l'étape suivante.
// Il vérifie seulement que l'application utilise bien le moteur de calcul.
const controle = calculerFacture(451, grilleTarif20Economique2022(3.3));
const montant = controle.total.toLocaleString("fr-FR", { minimumFractionDigits: 2 });

function App() {
  return (
    <main>
      <h1>Partage JIRAMA</h1>
      <p>Application en construction.</p>
      <p>
        Moteur de calcul branché : la facture d'avril 2022 (451 kWh) est recalculée à <b>{montant} Ar</b>.
      </p>
    </main>
  );
}

export default App;
