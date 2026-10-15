// Lance la CLI Firebase pour les émulateurs locaux.
//
// Sous Windows, l'émulateur Firestore (Java 19+) peut échouer au démarrage avec
// « Unable to establish loopback connection » quand le dossier temporaire des sockets locales a un
// chemin trop long. On lui donne un dossier court, sauf si JAVA_TOOL_OPTIONS est déjà défini.
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";

const env = { ...process.env };
if (process.platform === "win32" && !env.JAVA_TOOL_OPTIONS) {
  const dossier = join(homedir(), ".pj-java-tmp");
  mkdirSync(dossier, { recursive: true });
  env.JAVA_TOOL_OPTIONS = `-Djdk.net.unixdomain.tmpdir=${dossier}`;
}

// CLI de firebase-tools lancée directement avec Node : les arguments passent tels quels, sans shell.
const cli = createRequire(import.meta.url).resolve("firebase-tools/lib/bin/firebase.js");
const enfant = spawn(process.execPath, [cli, ...process.argv.slice(2)], { stdio: "inherit", env });
enfant.on("exit", (code) => process.exit(code ?? 1));
