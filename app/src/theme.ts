import { Badge, Button, createTheme, Input, Modal, Table, Tooltip, type MantineColorsTuple } from "@mantine/core";

// Encre presque noire : couleur principale des boutons et des éléments actifs.
const encre: MantineColorsTuple = [
  "#f3f3f4",
  "#e2e2e4",
  "#c4c4c8",
  "#a3a3a9",
  "#86868d",
  "#6b6b72",
  "#4f4f56",
  "#35353b",
  "#222327",
  "#111214",
];

/** Thème « papier » : aucun arrondi, aucune ombre, libellés en police à chasse fixe (spécification §12). */
export const theme = createTheme({
  primaryColor: "encre",
  primaryShade: 9,
  colors: { encre },
  black: "#111214",
  defaultRadius: 0,
  cursorType: "pointer",
  fontFamily: "Inter, system-ui, sans-serif",
  fontFamilyMonospace: "'JetBrains Mono', ui-monospace, monospace",
  headings: { fontFamily: "Inter, system-ui, sans-serif", fontWeight: "700" },
  components: {
    Button: Button.extend({ classNames: { root: "pj-bouton" } }),
    Input: Input.extend({ classNames: { input: "pj-champ" } }),
    InputWrapper: Input.Wrapper.extend({ classNames: { label: "pj-label-champ" } }),
    Badge: Badge.extend({ defaultProps: { radius: 0, variant: "outline" }, classNames: { root: "pj-etiquette" } }),
    Modal: Modal.extend({ defaultProps: { centered: true, radius: 0 }, classNames: { title: "pj-titre-modale" } }),
    Table: Table.extend({ classNames: { th: "pj-th" } }),
    Tooltip: Tooltip.extend({ defaultProps: { radius: 0 } }),
  },
});
