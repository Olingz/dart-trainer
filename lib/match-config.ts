export type CheckoutMode = "straight" | "double";
export type BotDifficulty = "easy" | "medium" | "hard";

export type GameSetupInput = {
  startScore: 301 | 501;
  legsToWin: number;
  setsToWin: number;
  checkoutMode: CheckoutMode;
  /** IDs fra local_opponents — max 5 modstandere */
  opponentIds: string[];
  /** Spil mod bot — kan ikke kombineres med lokale modstandere */
  botDifficulty: BotDifficulty | null;
};

export const DEFAULT_GAME_SETUP: GameSetupInput = {
  startScore: 301,
  legsToWin: 1,
  setsToWin: 1,
  checkoutMode: "straight",
  opponentIds: [],
  botDifficulty: null,
};

export function validateGameSetup(input: GameSetupInput): string | null {
  if (input.startScore !== 301 && input.startScore !== 501) {
    return "Startscore skal være 301 eller 501";
  }
  if (!Number.isInteger(input.legsToWin) || input.legsToWin < 1 || input.legsToWin > 21) {
    return "Legs skal være 1–21";
  }
  if (!Number.isInteger(input.setsToWin) || input.setsToWin < 1 || input.setsToWin > 21) {
    return "Sets skal være 1–21";
  }
  if (input.checkoutMode !== "straight" && input.checkoutMode !== "double") {
    return "Ugyldig checkout-regel";
  }
  if (!Array.isArray(input.opponentIds)) {
    return "Ugyldige modstandere";
  }
  if (input.opponentIds.length > 5) {
    return "Højst 5 modstandere ad gangen";
  }
  if (input.botDifficulty && input.opponentIds.length > 0) {
    return "Vælg enten bot eller lokale modstandere";
  }
  if (
    input.botDifficulty &&
    !["easy", "medium", "hard"].includes(input.botDifficulty)
  ) {
    return "Ugyldig bot-sværhedsgrad";
  }
  return null;
}

export function checkoutModeLabel(mode: CheckoutMode): string {
  return mode === "double" ? "Double out" : "Straight out";
}

export function formatMatchRules(game: {
  start_score: number;
  checkout_mode: CheckoutMode;
  legs_to_win: number;
  sets_to_win: number;
}): string {
  const checkout = checkoutModeLabel(game.checkout_mode);
  if (game.sets_to_win === 1 && game.legs_to_win === 1) {
    return `${game.start_score} · ${checkout}`;
  }
  return `${game.start_score} · ${game.sets_to_win} set · ${game.legs_to_win} legs · ${checkout}`;
}
