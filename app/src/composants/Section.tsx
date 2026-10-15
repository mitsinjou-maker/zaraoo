import type { ReactNode } from "react";

interface Props {
  id: string;
  numero: string;
  titre: string;
  actions?: ReactNode;
  children: ReactNode;
}

/** Bloc numéroté « 01 / TITRE » avec bordure fine. */
export function Section({ id, numero, titre, actions, children }: Props) {
  return (
    <section className="pj-section" id={id}>
      <div className="pj-section-tete">
        <span className="pj-libelle">
          {numero} / <b>{titre}</b>
        </span>
        {actions}
      </div>
      <div className="pj-section-corps">{children}</div>
    </section>
  );
}

export function PastilleLogement({ id, couleur }: { id: string; couleur: string }) {
  return (
    <span className="pj-logement" style={{ background: couleur }}>
      {id}
    </span>
  );
}
