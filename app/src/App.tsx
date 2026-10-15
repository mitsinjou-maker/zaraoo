import { Loader, MantineProvider } from "@mantine/core";
import { lazy, Suspense } from "react";
import { useSession } from "./hooks/useSession";
import { Connexion } from "./pages/Connexion";
import { theme } from "./theme";

// Espace admin chargé après la connexion seulement.
const Espace = lazy(() => import("./pages/Espace"));

function Chargement() {
  return (
    <div className="pj-plein-ecran">
      <Loader color="dark" size="sm" />
    </div>
  );
}

function Contenu() {
  const session = useSession();

  if (session.mode === "local") {
    return (
      <Suspense fallback={<Chargement />}>
        <Espace uid={null} compte={{ email: null }} />
      </Suspense>
    );
  }
  if (session.etat === "chargement") return <Chargement />;
  if (session.etat === "deconnecte") return <Connexion />;
  return (
    <Suspense fallback={<Chargement />}>
      <Espace
        key={session.utilisateur.uid}
        uid={session.utilisateur.uid}
        compte={{ email: session.utilisateur.email, deconnecter: () => void session.deconnecter() }}
      />
    </Suspense>
  );
}

function App() {
  return (
    <MantineProvider theme={theme} forceColorScheme="light">
      <Contenu />
    </MantineProvider>
  );
}

export default App;
