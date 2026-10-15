import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Polices hébergées avec l'application (pas d'appel à Google Fonts), alphabet latin seulement.
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/inter/latin-800.css";
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-500.css";
import "@fontsource/jetbrains-mono/latin-600.css";
import "@fontsource/jetbrains-mono/latin-700.css";
import "@mantine/core/styles.css";
import "./index.css";
import App from "./App.tsx";

// Après une mise en ligne, une page restée ouverte peut réclamer un module de l'ancienne version, qui
// n'existe plus : on recharge une fois pour obtenir la nouvelle version (au plus une fois par minute).
window.addEventListener("vite:preloadError", (evenement) => {
  try {
    const dernier = Number(sessionStorage.getItem("zaraoo:rechargement") ?? 0);
    if (Date.now() - dernier < 60_000) return;
    sessionStorage.setItem("zaraoo:rechargement", String(Date.now()));
  } catch {
    // Stockage indisponible : on recharge quand même ; la page rechargée référence la nouvelle version.
  }
  evenement.preventDefault();
  window.location.reload();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
