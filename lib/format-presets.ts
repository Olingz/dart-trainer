export type FormatPresetId = "single" | "legs3" | "match" | "custom";

export const FORMAT_PRESETS: Record<
  Exclude<FormatPresetId, "custom">,
  { label: string; description: string; setsToWin: number; legsToWin: number }
> = {
  single: {
    label: "Ét leg",
    description: "Hurtig træningsrunde",
    setsToWin: 1,
    legsToWin: 1,
  },
  legs3: {
    label: "3 legs",
    description: "Først til 3 legs vinder",
    setsToWin: 1,
    legsToWin: 3,
  },
  match: {
    label: "Fuldt match",
    description: "3 set · 3 legs",
    setsToWin: 3,
    legsToWin: 3,
  },
};
