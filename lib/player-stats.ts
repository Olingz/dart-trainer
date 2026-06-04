import { formatThreeDartAverage } from "@/lib/dart-stats";

export type StatsDartThrow = {
  points: number;
  segment: number | null;
  multiplier: number;
  is_miss: boolean;
  is_bull: boolean;
};

export type StatsRound = {
  points_scored: number;
  score_before: number;
  score_after: number;
  is_bust: boolean;
  dart_throws: StatsDartThrow[];
};

export type StatsGame = {
  id: string;
  status: string;
  start_score: number;
  started_at: string;
  finished_at: string | null;
  rounds: StatsRound[];
};

export type RecentGameSummary = {
  id: string;
  status: string;
  startScore: number;
  startedAt: string;
  finishedAt: string | null;
  roundCount: number;
  dartCount: number;
  threeDartAverage: number | null;
  bestVisit: number;
  bustCount: number;
};

export type PlayerStats = {
  totalGames: number;
  completedGames: number;
  abandonedGames: number;
  inProgressGames: number;
  totalDarts: number;
  totalRounds: number;
  totalBusts: number;
  threeDartAverage: number | null;
  bestVisit: number;
  checkoutRate: number | null;
  avgDartsPerCompletedGame: number | null;
  recentGames: RecentGameSummary[];
  favoriteThrows: { label: string; count: number }[];
};

function throwLabel(t: StatsDartThrow): string {
  if (t.is_miss) return "Miss";
  if (t.is_bull) return t.multiplier === 2 ? "D50" : "25";
  if (t.segment && t.multiplier === 3) return `T${t.segment}`;
  if (t.segment && t.multiplier === 2) return `D${t.segment}`;
  if (t.segment) return `${t.segment}`;
  return `${t.points}`;
}

function summarizeGame(game: StatsGame): RecentGameSummary {
  let dartCount = 0;
  let totalPoints = 0;
  let bestVisit = 0;
  let bustCount = 0;

  for (const round of game.rounds) {
    if (round.is_bust) bustCount += 1;
    if (!round.is_bust && round.points_scored > bestVisit) {
      bestVisit = round.points_scored;
    }
    for (const dart of round.dart_throws) {
      dartCount += 1;
      totalPoints += dart.points;
    }
  }

  const threeDartAverage =
    dartCount > 0 ? (totalPoints / dartCount) * 3 : null;

  return {
    id: game.id,
    status: game.status,
    startScore: game.start_score,
    startedAt: game.started_at,
    finishedAt: game.finished_at,
    roundCount: game.rounds.length,
    dartCount,
    threeDartAverage,
    bestVisit,
    bustCount,
  };
}

export function computePlayerStats(games: StatsGame[]): PlayerStats {
  const recentGames = games.map(summarizeGame);

  let totalDarts = 0;
  let totalPoints = 0;
  let totalRounds = 0;
  let totalBusts = 0;
  let bestVisit = 0;
  let completedGames = 0;
  let abandonedGames = 0;
  let inProgressGames = 0;
  let checkoutAttempts = 0;
  let checkoutHits = 0;
  let completedDartTotals = 0;
  const throwCounts = new Map<string, number>();

  for (const game of games) {
    if (game.status === "completed") completedGames += 1;
    else if (game.status === "abandoned") abandonedGames += 1;
    else inProgressGames += 1;

    let gameDarts = 0;

    for (const round of game.rounds) {
      totalRounds += 1;
      if (round.is_bust) totalBusts += 1;

      if (!round.is_bust && round.points_scored > bestVisit) {
        bestVisit = round.points_scored;
      }

      if (round.score_before <= 170 && round.score_before > 1) {
        checkoutAttempts += 1;
        if (round.score_after === 0 && !round.is_bust) {
          checkoutHits += 1;
        }
      }

      for (const dart of round.dart_throws) {
        gameDarts += 1;
        totalDarts += 1;
        totalPoints += dart.points;

        const label = throwLabel(dart);
        throwCounts.set(label, (throwCounts.get(label) ?? 0) + 1);
      }
    }

    if (game.status === "completed") {
      completedDartTotals += gameDarts;
    }
  }

  const threeDartAverage =
    totalDarts > 0 ? (totalPoints / totalDarts) * 3 : null;

  const checkoutRate =
    checkoutAttempts > 0 ? (checkoutHits / checkoutAttempts) * 100 : null;

  const avgDartsPerCompletedGame =
    completedGames > 0 ? completedDartTotals / completedGames : null;

  const favoriteThrows = [...throwCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, count]) => ({ label, count }));

  return {
    totalGames: games.length,
    completedGames,
    abandonedGames,
    inProgressGames,
    totalDarts,
    totalRounds,
    totalBusts,
    threeDartAverage,
    bestVisit,
    checkoutRate,
    avgDartsPerCompletedGame,
    recentGames,
    favoriteThrows,
  };
}

export function formatAverage(value: number | null): string {
  return formatThreeDartAverage(value);
}

export function formatPercent(value: number | null): string {
  if (value === null) return "—";
  return `${Math.round(value)}%`;
}

export function statusLabel(status: string): string {
  if (status === "completed") return "Vundet";
  if (status === "abandoned") return "Afsluttet";
  return "I gang";
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
