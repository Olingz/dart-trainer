import {
  calculateDartPoints,
  DARTS_PER_ROUND,
  type DartInput,
} from "@/lib/dart-score";
import type { CheckoutMode } from "@/lib/match-config";

export { DARTS_PER_ROUND };

export type RoundResult = {
  scoreBefore: number;
  scoreAfter: number;
  pointsScored: number;
  isBust: boolean;
  isWin: boolean;
};

export const MAX_DARTS_PER_VISIT = DARTS_PER_ROUND;

/** Double out: afslutning skal være på double (inkl. bull 50). */
export function isDoubleFinishDart(dart: DartInput): boolean {
  if (dart.kind === "miss") return false;
  if (dart.kind === "bull") return dart.multiplier === 2;
  return dart.multiplier === 2;
}

function isBustRemaining(remaining: number): boolean {
  return remaining < 0 || remaining === 1;
}

function finishOnZero(
  scoreBefore: number,
  darts: DartInput[],
  checkoutMode: CheckoutMode,
): RoundResult {
  const total = darts.reduce((sum, d) => sum + calculateDartPoints(d), 0);
  const last = darts[darts.length - 1];

  if (
    checkoutMode === "double" &&
    last &&
    !isDoubleFinishDart(last)
  ) {
    return {
      scoreBefore,
      scoreAfter: scoreBefore,
      pointsScored: total,
      isBust: true,
      isWin: false,
    };
  }

  return {
    scoreBefore,
    scoreAfter: 0,
    pointsScored: total,
    isBust: false,
    isWin: true,
  };
}

export function applyRound(
  scoreBefore: number,
  pointsScored: number,
  checkoutMode: CheckoutMode = "straight",
): RoundResult {
  const remaining = scoreBefore - pointsScored;

  if (pointsScored > scoreBefore || isBustRemaining(remaining)) {
    return {
      scoreBefore,
      scoreAfter: scoreBefore,
      pointsScored,
      isBust: true,
      isWin: false,
    };
  }

  if (remaining === 0) {
    if (checkoutMode === "double") {
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
      scoreAfter: 0,
      pointsScored,
      isBust: false,
      isWin: true,
    };
  }

  return {
    scoreBefore,
    scoreAfter: remaining,
    pointsScored,
    isBust: false,
    isWin: false,
  };
}

export function evaluateVisit(
  scoreBefore: number,
  darts: DartInput[],
  checkoutMode: CheckoutMode = "straight",
): RoundResult | null {
  let total = 0;

  for (const dart of darts) {
    total += calculateDartPoints(dart);
    const remaining = scoreBefore - total;

    if (isBustRemaining(remaining)) {
      return {
        scoreBefore,
        scoreAfter: scoreBefore,
        pointsScored: total,
        isBust: true,
        isWin: false,
      };
    }

    if (remaining === 0) {
      return finishOnZero(scoreBefore, darts, checkoutMode);
    }
  }

  if (darts.length >= DARTS_PER_ROUND) {
    return applyRound(scoreBefore, total, checkoutMode);
  }

  return null;
}

export type MatchCounters = {
  setsWon: number;
  legsWon: number;
  currentSet: number;
  currentLeg: number;
};

export type MatchFormat = {
  legsToWin: number;
  setsToWin: number;
};

export function advanceAfterLegWin(
  counters: MatchCounters,
  format: MatchFormat,
): {
  counters: MatchCounters;
  matchComplete: boolean;
  setWon: boolean;
  legWon: boolean;
} {
  const legWon = true;
  let legsWon = counters.legsWon + 1;
  let setsWon = counters.setsWon;
  let currentSet = counters.currentSet;
  let currentLeg = counters.currentLeg;
  let setWon = false;

  if (legsWon >= format.legsToWin) {
    setWon = true;
    setsWon += 1;
    legsWon = 0;
    if (setsWon >= format.setsToWin) {
      return {
        counters: { setsWon, legsWon, currentSet, currentLeg },
        matchComplete: true,
        setWon,
        legWon,
      };
    }
    currentSet += 1;
    currentLeg = 1;
  } else {
    currentLeg += 1;
  }

  return {
    counters: { setsWon, legsWon, currentSet, currentLeg },
    matchComplete: false,
    setWon,
    legWon,
  };
}
