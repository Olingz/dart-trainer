import Link from "next/link";
import { redirect } from "next/navigation";

import { formatMatchRules } from "@/lib/match-config";
import {
  computePlayerStats,
  formatAverage,
  formatDate,
  formatPercent,
  statusLabel,
  type StatsGame,
} from "@/lib/player-stats";
import { createClient } from "@/lib/supabase/server";

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="dart-panel rounded-xl p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-dart-muted">
        {label}
      </p>
      <p className="font-display mt-1 text-3xl leading-none tabular-nums text-dart-cream">
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-dart-muted">{sub}</p>}
    </div>
  );
}

export default async function StatsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: games } = await supabase
    .from("game_sessions")
    .select(
      `
      id,
      status,
      start_score,
      checkout_mode,
      legs_to_win,
      sets_to_win,
      started_at,
      finished_at,
      rounds (
        points_scored,
        score_before,
        score_after,
        is_bust,
        dart_throws (
          points,
          segment,
          multiplier,
          is_miss,
          is_bull
        )
      )
    `,
    )
    .eq("user_id", user.id)
    .order("started_at", { ascending: false });

  const stats = computePlayerStats((games ?? []) as StatsGame[]);
  const hasData = stats.totalGames > 0;

  return (
    <div className="flex min-h-full flex-1 flex-col px-4 py-6">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="text-sm font-medium text-dart-muted underline active:text-dart-cream"
          >
            ← Forside
          </Link>
          <p className="font-display text-xl text-dart-red">Statistik</p>
        </div>

        {!hasData ? (
          <div className="dart-panel rounded-xl p-6 text-center">
            <p className="text-dart-cream">Ingen spil endnu</p>
            <p className="mt-2 text-sm text-dart-muted">
              Spil et 301-spil for at se average, bedste tur og mere.
            </p>
            <Link
              href="/"
              className="font-display mt-6 inline-block rounded-xl border-2 border-dart-cream bg-dart-green px-6 py-3 text-xl text-dart-cream"
            >
              Start spil
            </Link>
          </div>
        ) : (
          <>
            <section>
              <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-dart-muted">
                Overblik
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  label="3-pile snit"
                  value={formatAverage(stats.threeDartAverage)}
                  sub={`${stats.totalDarts} pile`}
                />
                <StatCard
                  label="Bedste tur"
                  value={stats.bestVisit > 0 ? `${stats.bestVisit}` : "—"}
                  sub="point (uden bust)"
                />
                <StatCard
                  label="Spil"
                  value={`${stats.totalGames}`}
                  sub={`${stats.completedGames} vundet`}
                />
                <StatCard
                  label="Busts"
                  value={`${stats.totalBusts}`}
                  sub={`${stats.totalRounds} runder`}
                />
              </div>
            </section>

            {(stats.avgDartsPerCompletedGame !== null ||
              stats.checkoutRate !== null) && (
              <section>
                <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-dart-muted">
                  Præstation
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  {stats.avgDartsPerCompletedGame !== null && (
                    <StatCard
                      label="Pile pr. vundet"
                      value={Math.round(
                        stats.avgDartsPerCompletedGame,
                      ).toString()}
                      sub="gennemsnit"
                    />
                  )}
                  {stats.checkoutRate !== null && (
                    <StatCard
                      label="Checkout"
                      value={formatPercent(stats.checkoutRate)}
                      sub="ved ≤170"
                    />
                  )}
                </div>
              </section>
            )}

            {stats.favoriteThrows.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-dart-muted">
                  Mest ramte
                </h2>
                <ul className="dart-panel divide-y divide-dart-wire/40 rounded-xl">
                  {stats.favoriteThrows.map((item) => (
                    <li
                      key={item.label}
                      className="flex items-center justify-between px-4 py-3"
                    >
                      <span className="font-display text-lg text-dart-cream">
                        {item.label}
                      </span>
                      <span className="tabular-nums text-dart-muted">
                        {item.count}×
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-dart-muted">
                Seneste spil
              </h2>
              <ul className="flex flex-col gap-2">
                {stats.recentGames.slice(0, 15).map((game) => (
                  <li key={game.id}>
                    <Link
                      href={`/game/${game.id}`}
                      className="dart-panel block rounded-xl px-4 py-3 transition-opacity active:opacity-80"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm text-dart-cream">
                            {formatMatchRules({
                              start_score: game.startScore,
                              checkout_mode: game.checkoutMode,
                              legs_to_win: game.legsToWin,
                              sets_to_win: game.setsToWin,
                            })}
                          </p>
                          <p className="text-xs text-dart-muted">
                            {formatDate(game.startedAt)}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${
                            game.status === "completed"
                              ? "bg-dart-green/25 text-dart-green"
                              : game.status === "abandoned"
                                ? "bg-dart-wire/30 text-dart-muted"
                                : "bg-dart-red/20 text-dart-red"
                          }`}
                        >
                          {statusLabel(game.status)}
                        </span>
                      </div>
                      <div className="mt-2 flex gap-4 text-xs tabular-nums text-dart-muted">
                        <span>
                          Avg{" "}
                          <strong className="text-dart-cream">
                            {formatAverage(game.threeDartAverage)}
                          </strong>
                        </span>
                        <span>
                          Bedste tur{" "}
                          <strong className="text-dart-cream">
                            {game.bestVisit || "—"}
                          </strong>
                        </span>
                        <span>{game.dartCount} pile</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
