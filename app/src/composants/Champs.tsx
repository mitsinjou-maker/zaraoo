import { NumberInput, type NumberInputProps } from "@mantine/core";
import { DateInput, type DateInputProps } from "@mantine/dates";
import { useState } from "react";
import { lireDate } from "../domaine/format";

function versNombre(v: string | number): number | null {
  if (typeof v === "number") return v;
  if (v.trim() === "") return null;
  const n = Number(v.replace(/\s/g, "").replace(",", "."));
  return Number.isNaN(n) ? Number.NaN : n;
}

type PropsNombre = Omit<NumberInputProps, "value" | "onChange"> & {
  valeur: number | null;
  onValeur: (v: number | null) => void;
};

/** Champ numérique au format français (30 400 ; 3,5). `null` quand il est vide. */
export function ChampNombre({ valeur, onValeur, ...props }: PropsNombre) {
  const [brut, setBrut] = useState<string | number>(valeur ?? "");
  const [valeurConnue, setValeurConnue] = useState(valeur);

  // Resynchronise si la valeur change de l'extérieur (réinitialisation du brouillon…),
  // sans écraser une saisie en cours qui représente déjà cette valeur (« 3, » pour 3).
  if (valeur !== valeurConnue) {
    setValeurConnue(valeur);
    if (versNombre(brut) !== valeur) setBrut(valeur ?? "");
  }

  return (
    <NumberInput
      value={brut}
      onChange={(v) => {
        setBrut(v);
        const n = versNombre(v);
        if (n === null || !Number.isNaN(n)) onValeur(n);
      }}
      thousandSeparator=" "
      decimalSeparator=","
      allowNegative={false}
      hideControls
      {...props}
    />
  );
}

type PropsDate = Omit<DateInputProps, "value" | "onChange"> & {
  valeur: string | null;
  onValeur: (v: string | null) => void;
};

/** Champ date affiché JJ/MM/AAAA, valeur AAAA-MM-JJ. */
export function ChampDate({ valeur, onValeur, ...props }: PropsDate) {
  return (
    <DateInput
      value={valeur}
      onChange={onValeur}
      valueFormat="DD/MM/YYYY"
      dateParser={lireDate}
      placeholder="JJ/MM/AAAA"
      {...props}
    />
  );
}
