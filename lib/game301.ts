import {
  calculateDartPoints,
  DARTS_PER_ROUND,
  type DartInput,
} from "@/lib/dart-score";

export { DARTS_PER_ROUND };

export type RoundResult = {
  scoreBefore: number;
  scoreAfter: number;
  pointsScored: number;
  isBust: boolean;
  isWin: boolean;
};

export const MAX_DARTS_PER_VISIT = DARTS_PER_ROUND;

/** Uformel 301: bust ved under 0 eller rest 1; præcis 0 = vundet. */
export function applyRound(
  scoreBefore: number,
  pointsScored: number,
): RoundResult {
  const remaining = scoreBefore - pointsScored;
  const isBust =
    pointsScored > scoreBefore || remaining < 0 || remaining === 1;

  if (isBust) {
    return {
      scoreBefore,
      scoreAfter: scoreBefore,
      pointsScored,
      isBust: true,
      isWin: false,
    };
  }

  return {
    scoreBefore,
    scoreAfter: remaining,
    pointsScored,
    isBust: false,
    isWin: remaining === 0,
  };
}

/**
 * Vurderer en tur (1–3 kast). Returnerer resultat når runden er slut
 * (checkout, bust, eller 3 kast brugt). Ellers null = fortsæt tur.
 */
export function evaluateVisit(
  scoreBefore: number,
  darts: DartInput[],
): RoundResult | null {
  let total = 0;

  for (const dart of darts) {
    total += calculateDartPoints(dart);
    const remaining = scoreBefore - total;

    if (remaining < 0 || remaining === 1) {
      return {
        scoreBefore,
        scoreAfter: scoreBefore,
        pointsScored: total,
        isBust: true,
        isWin: false,
      };
    }

    if (remaining === 0) {
      return {
        scoreBefore,
        scoreAfter: 0,
        pointsScored: total,
        isBust: false,
        isWin: true,
      };
    }
  }

  if (darts.length >= DARTS_PER_ROUND) {
    return applyRound(scoreBefore, total);
  }

  return null;
}
