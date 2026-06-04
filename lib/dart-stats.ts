import { calculateDartPoints, type DartInput } from "@/lib/dart-score";

type RoundWithThrows = {
  dart_throws: { points: number }[];
};

/** Samme som TV/PDC: (sum point) / (antal pile) × 3 */
export function computeThreeDartAverage(
  rounds: RoundWithThrows[],
  currentVisitDarts: DartInput[] = [],
): { average: number | null; dartCount: number; totalPoints: number } {
  let totalPoints = 0;
  let dartCount = 0;

  for (const round of rounds) {
    for (const dartThrow of round.dart_throws) {
      totalPoints += dartThrow.points;
      dartCount += 1;
    }
  }

  for (const dart of currentVisitDarts) {
    totalPoints += calculateDartPoints(dart);
    dartCount += 1;
  }

  const average =
    dartCount > 0 ? (totalPoints / dartCount) * 3 : null;

  return { average, dartCount, totalPoints };
}

export function formatThreeDartAverage(average: number | null): string {
  if (average === null) return "—";
  return average.toFixed(2);
}
