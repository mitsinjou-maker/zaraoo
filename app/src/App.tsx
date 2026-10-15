import { MantineProvider } from "@mantine/core";
import { DatesProvider } from "@mantine/dates";
import "dayjs/locale/fr";
import { useEffect, useMemo, useState } from "react";
import { analyserBrouillon } from "./domaine/brouillon";
import { depotLocal } from "./donnees/depot";
import { useBrouillon } from "./hooks/useBrouillon";
import { RepartitionCycle } from "./pages/RepartitionCycle";
import { SaisieCycle } from "./pages/SaisieCycle";
import { theme } from "./theme";

type Vue = "saisie" | "repartition";

function App() {
  const { brouillon, modifier, remplacer, enregistreA } = useBrouillon(depotLocal);
  const analyse = useMemo(() => analyserBrouillon(brouillon), [brouillon]);
  const [vue, setVue] = useState<Vue>("saisie");

  // Chaque changement d'écran repart du haut de la page.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [vue]);

  return (
    <MantineProvider theme={theme} forceColorScheme="light">
      <DatesProvider settings={{ locale: "fr", firstDayOfWeek: 1 }}>
        {vue === "repartition" && analyse.resultat?.ok ? (
          <RepartitionCycle brouillon={brouillon} analyse={analyse} versSaisie={() => setVue("saisie")} />
        ) : (
          <SaisieCycle
            brouillon={brouillon}
            analyse={analyse}
            modifier={modifier}
            remplacer={remplacer}
            enregistreA={enregistreA}
            versRepartition={() => setVue("repartition")}
          />
        )}
      </DatesProvider>
    </MantineProvider>
  );
}

export default App;
