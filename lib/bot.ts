import {
  calculateDartPoints,
  DARTS_PER_ROUND,
  type DartInput,
} from "@/lib/dart-score";
import { evaluateVisit, isDoubleFinishDart } from "@/lib/game-rules";
import type { BotDifficulty, CheckoutMode } from "@/lib/match-config";

export type { BotDifficulty } from "@/lib/match-config";

export const BOT_DIFFICULTIES: BotDifficulty[] = ["easy", "medium", "hard"];

export function botDisplayName(difficulty: BotDifficulty): string {
  if (difficulty === "easy") return "Bot · Let";
  if (difficulty === "medium") return "Bot · Mellem";
  return "Bot · Svær";
}

export function botDifficultyLabel(difficulty: BotDifficulty): string {
  if (difficulty === "easy") return "Let";
  if (difficulty === "medium") return "Mellem";
  return "Svær";
}

export function botDifficultyDescription(difficulty: BotDifficulty): string {
  if (difficulty === "easy") {
    return "Mange miss og lav score — god til at øve";
  }
  if (difficulty === "medium") {
    return "Stabil scoring og enkel checkout";
  }
  return "Høj average og skarp ved checkout";
}

type BotConfig = {
  missWeight: number;
  tripleWeight: number;
  checkoutChance: number;
};

const CONFIG: Record<BotDifficulty, BotConfig> = {
  easy: { missWeight: 3.2, tripleWeight: 0.15, checkoutChance: 0.1 },
  medium: { missWeight: 1.1, tripleWeight: 1.4, checkoutChance: 0.4 },
  hard: { missWeight: 0.35, tripleWeight: 3.5, checkoutChance: 0.78 },
};

function random(): number {
  return Math.random();
}

function allDartOptions(): DartInput[] {
  const options: DartInput[] = [{ kind: "miss" }];
  for (let segment = 1; segment <= 20; segment += 1) {
    options.push({ kind: "segment", segment, multiplier: 1 });
    options.push({ kind: "segment", segment, multiplier: 2 });
    options.push({ kind: "segment", segment, multiplier: 3 });
  }
  options.push({ kind: "bull", multiplier: 1 });
  options.push({ kind: "bull", multiplier: 2 });
  return options;
}

const DART_OPTIONS = allDartOptions();

function isValidDart(
  remaining: number,
  dart: DartInput,
  checkoutMode: CheckoutMode,
): boolean {
  const points = calculateDartPoints(dart);
  const after = remaining - points;
  if (after < 0 || after === 1) return false;
  if (after === 0 && checkoutMode === "double" && !isDoubleFinishDart(dart)) {
    return false;
  }
  return true;
}

function validDartsFor(
  remaining: number,
  checkoutMode: CheckoutMode,
): DartInput[] {
  return DART_OPTIONS.filter((dart) =>
    isValidDart(remaining, dart, checkoutMode),
  );
}

function finishesOnDart(
  remaining: number,
  dart: DartInput,
  checkoutMode: CheckoutMode,
): boolean {
  return (
    remaining - calculateDartPoints(dart) === 0 &&
    isValidDart(remaining, dart, checkoutMode)
  );
}

function weightDart(
  dart: DartInput,
  remaining: number,
  difficulty: BotDifficulty,
  checkoutMode: CheckoutMode,
): number {
  const cfg = CONFIG[difficulty];
  if (dart.kind === "miss") return cfg.missWeight;

  const points = calculateDartPoints(dart);

  if (finishesOnDart(remaining, dart, checkoutMode)) {
    return 12 * cfg.checkoutChance;
  }

  if (dart.kind === "segment" && dart.multiplier === 3) {
    if (dart.segment === 20 && remaining >= 45) return cfg.tripleWeight * 4;
    if (dart.segment === 19 && remaining >= 42) return cfg.tripleWeight * 2.5;
    if (dart.segment === 18 && remaining >= 40) return cfg.tripleWeight * 1.5;
    return cfg.tripleWeight * 0.4;
  }

  if (dart.kind === "segment" && dart.multiplier === 2) {
    if (remaining <= 40 && remaining % 2 === 0) return 2;
    return 0.5;
  }

  if (dart.kind === "segment" && dart.multiplier === 1) {
    if (difficulty === "easy") return 1.2;
    if (remaining <= 20) return 1.5;
    return 0.6;
  }

  if (dart.kind === "bull") {
    if (remaining === 50 || remaining === 25) return 3;
    return 0.3;
  }

  return 0.1;
}

function pickWeighted(darts: DartInput[], weights: number[]): DartInput {
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = random() * total;
  for (let i = 0; i < darts.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) return darts[i];
  }
  return darts[darts.length - 1];
}

function pickDart(
  remaining: number,
  checkoutMode: CheckoutMode,
  difficulty: BotDifficulty,
): DartInput {
  const valid = validDartsFor(remaining, checkoutMode);
  if (valid.length === 0) return { kind: "miss" };

  const finishers = valid.filter((dart) =>
    finishesOnDart(remaining, dart, checkoutMode),
  );
  if (
    finishers.length > 0 &&
    random() < CONFIG[difficulty].checkoutChance
  ) {
    return finishers[Math.floor(random() * finishers.length)];
  }

  const weights = valid.map((dart) =>
    weightDart(dart, remaining, difficulty, checkoutMode),
  );
  return pickWeighted(valid, weights);
}

function buildVisit(
  scoreBefore: number,
  checkoutMode: CheckoutMode,
  difficulty: BotDifficulty,
): DartInput[] {
  const darts: DartInput[] = [];
  let remaining = scoreBefore;

  for (let i = 0; i < DARTS_PER_ROUND; i += 1) {
    const dart = pickDart(remaining, checkoutMode, difficulty);
    darts.push(dart);
    remaining -= calculateDartPoints(dart);
    if (remaining <= 0) break;
  }

  return darts;
}

/** Genererer en gyldig bot-tur (1–3 pile). */
export function generateBotVisit(
  scoreBefore: number,
  checkoutMode: CheckoutMode,
  difficulty: BotDifficulty,
): DartInput[] {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const darts = buildVisit(scoreBefore, checkoutMode, difficulty);
    const result = evaluateVisit(scoreBefore, darts, checkoutMode);
    if (result) return darts;
  }

  return [{ kind: "miss" }, { kind: "miss" }, { kind: "miss" }];
}

export function botThinkDelayMs(difficulty: BotDifficulty): number {
  if (difficulty === "easy") return 1400;
  if (difficulty === "medium") return 1100;
  return 850;
}
