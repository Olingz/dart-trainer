import {
  computeThreeDartAverage,
  formatThreeDartAverage,
} from "@/lib/dart-stats";
import type { DartInput } from "@/lib/dart-score";

type RoundWithThrows = {
  dart_throws: { points: number }[];
};

/** Lille sekundær linje under score — average er mindre vigtig end resterende. */
export function GameStatsBar({
  rounds,
  currentVisitDarts = [],
  onDark = true,
}: {
  rounds: RoundWithThrows[];
  currentVisitDarts?: DartInput[];
  onDark?: boolean;
}) {
  const { average, dartCount } = computeThreeDartAverage(
    rounds,
    currentVisitDarts,
  );

  const textClass = onDark ? "text-dart-wire" : "text-dart-cream/70";

  return (
    <p
      className={`mt-3 text-center text-xs tabular-nums ${textClass}`}
    >
      <span className="uppercase tracking-wide">Avg</span>{" "}
      <span className="font-semibold">{formatThreeDartAverage(average)}</span>
      <span className="mx-2 opacity-40">·</span>
      <span className="uppercase tracking-wide">Pile</span>{" "}
      <span className="font-semibold">{dartCount}</span>
    </p>
  );
}
