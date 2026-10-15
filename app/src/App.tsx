import { Loader, MantineProvider } from "@mantine/core";
import { DatesProvider } from "@mantine/dates";
import "dayjs/locale/fr";
import { useMemo } from "react";
import { depotLocal } from "./donnees/depot";
import { depotFirebase } from "./donnees/depotFirebase";
import { firebase } from "./firebase/config";
import { useSession } from "./hooks/useSession";
import { Connexion } from "./pages/Connexion";
import { EspaceAdmin } from "./pages/EspaceAdmin";
import { theme } from "./theme";

function Contenu() {
  const session = useSession();
  const uid = session.mode === "firebase" && session.etat === "connecte" ? session.utilisateur.uid : null;
  const depot = useMemo(() => (uid ? depotFirebase(firebase().db, uid) : depotLocal), [uid]);

  if (session.mode === "local") {
    return <EspaceAdmin depot={depot} compte={{ email: null }} />;
  }
  if (session.etat === "chargement") {
    return (
      <div className="pj-plein-ecran">
        <Loader color="dark" size="sm" />
      </div>
    );
  }
  if (session.etat === "deconnecte") return <Connexion />;
  return (
    <EspaceAdmin
      key={session.utilisateur.uid}
      depot={depot}
      compte={{ email: session.utilisateur.email, deconnecter: () => void session.deconnecter() }}
    />
  );
}

function App() {
  return (
    <MantineProvider theme={theme} forceColorScheme="light">
      <DatesProvider settings={{ locale: "fr", firstDayOfWeek: 1 }}>
        <Contenu />
      </DatesProvider>
    </MantineProvider>
  );
}

export default App;
