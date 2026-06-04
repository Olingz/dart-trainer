import type { SupabaseClient } from "@supabase/supabase-js";

import { applyRound } from "@/lib/game301";

type ThrowRow = {
  throw_number: number;
  points: number;
};

type RoundRow = {
  id: string;
  round_number: number;
  dart_throws: ThrowRow[];
};

export async function recalculateGameSession(
  supabase: SupabaseClient,
  gameId: string,
  startScore: number,
): Promise<{ error?: string }> {
  const { data: rounds, error: roundsError } = await supabase
    .from("rounds")
    .select(
      `
      id,
      round_number,
      dart_throws (
        throw_number,
        points
      )
    `,
    )
    .eq("game_session_id", gameId)
    .order("round_number", { ascending: true });

  if (roundsError) {
    return { error: roundsError.message };
  }

  let current = startScore;
  let isWin = false;

  for (const round of (rounds ?? []) as RoundRow[]) {
    const darts = [...(round.dart_throws ?? [])].sort(
      (a, b) => a.throw_number - b.throw_number,
    );
    const pointsScored = darts.reduce((sum, dart) => sum + dart.points, 0);
    const result = applyRound(current, pointsScored);

    const { error: roundUpdateError } = await supabase
      .from("rounds")
      .update({
        points_scored: result.pointsScored,
        score_before: result.scoreBefore,
        score_after: result.scoreAfter,
        is_bust: result.isBust,
      })
      .eq("id", round.id);

    if (roundUpdateError) {
      return { error: roundUpdateError.message };
    }

    current = result.scoreAfter;
    isWin = result.isWin;
  }

  const { error: sessionError } = await supabase
    .from("game_sessions")
    .update({
      current_score: current,
      status: isWin ? "completed" : "in_progress",
      finished_at: isWin ? new Date().toISOString() : null,
    })
    .eq("id", gameId);

  if (sessionError) {
    return { error: sessionError.message };
  }

  return {};
}
