export const DARTS_PER_ROUND = 3;

export type DartInput =
  | { kind: "miss" }
  | { kind: "bull"; multiplier: 1 | 2 }
  | { kind: "segment"; segment: number; multiplier: 1 | 2 | 3 };

export type DartThrowRow = {
  id: string;
  throw_number: number;
  points: number;
  segment: number | null;
  multiplier: number;
  is_miss: boolean;
  is_bull: boolean;
};

export function dartThrowRowToInput(row: DartThrowRow): DartInput {
  if (row.is_miss) return { kind: "miss" };
  if (row.is_bull) {
    return { kind: "bull", multiplier: row.multiplier === 2 ? 2 : 1 };
  }
  return {
    kind: "segment",
    segment: row.segment ?? 1,
    multiplier: row.multiplier as 1 | 2 | 3,
  };
}

export const BOARD_NUMBERS = Array.from({ length: 20 }, (_, i) => i + 1);

export function isTripleTwenty(dart: DartInput): boolean {
  return dart.kind === "segment" && dart.segment === 20 && dart.multiplier === 3;
}

export function calculateDartPoints(dart: DartInput): number {
  if (dart.kind === "miss") return 0;
  if (dart.kind === "bull") return dart.multiplier === 2 ? 50 : 25;
  return dart.segment * dart.multiplier;
}

export function formatDartLabel(dart: DartInput | DartThrowRow): string {
  if ("kind" in dart) {
    if (dart.kind === "miss") return "Miss";
    if (dart.kind === "bull") return dart.multiplier === 2 ? "D50" : "25";
    if (dart.multiplier === 3) return `T${dart.segment}`;
    if (dart.multiplier === 2) return `D${dart.segment}`;
    return `${dart.segment}`;
  }

  if (dart.is_miss) return "Miss";
  if (dart.is_bull) return dart.multiplier === 2 ? "D50" : "25";
  if (dart.multiplier === 3) return `T${dart.segment}`;
  if (dart.multiplier === 2) return `D${dart.segment}`;
  return `${dart.segment}`;
}

export function validateDartInput(dart: DartInput): string | null {
  if (dart.kind === "miss") return null;

  if (dart.kind === "bull") {
    if (dart.multiplier !== 1 && dart.multiplier !== 2) {
      return "Bull: kun single (25) eller double (50)";
    }
    return null;
  }

  if (!Number.isInteger(dart.segment) || dart.segment < 1 || dart.segment > 20) {
    return "Felt skal være 1–20";
  }

  if (![1, 2, 3].includes(dart.multiplier)) {
    return "Multiplikator skal være 1, 2 eller 3";
  }

  return null;
}

export function validateVisitDarts(darts: DartInput[]): string | null {
  if (darts.length < 1 || darts.length > DARTS_PER_ROUND) {
    return `En tur skal have 1–${DARTS_PER_ROUND} kast`;
  }

  for (const dart of darts) {
    const error = validateDartInput(dart);
    if (error) return error;
  }

  return null;
}

export function sumDartInputs(darts: DartInput[]): number {
  return darts.reduce((total, dart) => total + calculateDartPoints(dart), 0);
}

export function dartInputToDbRow(
  dart: DartInput,
  roundId: string,
  throwNumber: number,
) {
  const points = calculateDartPoints(dart);

  if (dart.kind === "miss") {
    return {
      round_id: roundId,
      throw_number: throwNumber,
      points,
      is_miss: true,
      is_bull: false,
      segment: null,
      multiplier: 1,
    };
  }

  if (dart.kind === "bull") {
    return {
      round_id: roundId,
      throw_number: throwNumber,
      points,
      is_miss: false,
      is_bull: true,
      segment: null,
      multiplier: dart.multiplier,
    };
  }

  return {
    round_id: roundId,
    throw_number: throwNumber,
    points,
    is_miss: false,
    is_bull: false,
    segment: dart.segment,
    multiplier: dart.multiplier,
  };
}
