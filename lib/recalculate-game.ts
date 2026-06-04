import type { SupabaseClient } from "@supabase/supabase-js";

import { dartThrowRowToInput, type DartThrowRow } from "@/lib/dart-score";
import { advanceAfterLegWin, evaluateVisit } from "@/lib/game-rules";
import type { CheckoutMode } from "@/lib/match-config";

type ThrowRow = DartThrowRow;

type RoundRow = {
  id: string;
  round_number: number;
  dart_throws: ThrowRow[];
};

type SessionFormat = {
  start_score: number;
  checkout_mode: CheckoutMode;
  legs_to_win: number;
  sets_to_win: number;
};

export async function recalculateGameSession(
  supabase: SupabaseClient,
  gameId: string,
  format: SessionFormat,
): Promise<{ error?: string }> {
  const { data: rounds, error: roundsError } = await supabase
    .from("rounds")
    .select(
      `
      id,
      round_number,
      dart_throws (
        throw_number,
        points,
        segment,
        multiplier,
        is_miss,
        is_bull
      )
    `,
    )
    .eq("game_session_id", gameId)
    .order("round_number", { ascending: true });

  if (roundsError) {
    return { error: roundsError.message };
  }

  let current = format.start_score;
  let counters = {
    setsWon: 0,
    legsWon: 0,
    currentSet: 1,
    currentLeg: 1,
  };
  let matchComplete = false;

  for (const round of (rounds ?? []) as RoundRow[]) {
    const darts = [...(round.dart_throws ?? [])]
      .sort((a, b) => a.throw_number - b.throw_number)
      .map(dartThrowRowToInput);

    const result = evaluateVisit(
      current,
      darts,
      format.checkout_mode,
    );

    if (!result) {
      return { error: "Ugyldig runde i databasen" };
    }

    const { error: roundUpdateError } = await supabase
      .from("rounds")
      .update({
        points_scored: result.pointsScored,
        score_before: result.scoreBefore,
        score_after: result.isWin ? 0 : result.scoreAfter,
        is_bust: result.isBust,
      })
      .eq("id", round.id);

    if (roundUpdateError) {
      return { error: roundUpdateError.message };
    }

    if (result.isWin) {
      const advanced = advanceAfterLegWin(counters, {
        legsToWin: format.legs_to_win,
        setsToWin: format.sets_to_win,
      });
      counters = advanced.counters;
      matchComplete = advanced.matchComplete;
      current = matchComplete ? 0 : format.start_score;
    } else {
      current = result.scoreAfter;
    }
  }

  const { error: sessionError } = await supabase
    .from("game_sessions")
    .update({
      current_score: current,
      sets_won: counters.setsWon,
      legs_won: counters.legsWon,
      current_set: counters.currentSet,
      current_leg: counters.currentLeg,
      status: matchComplete ? "completed" : "in_progress",
      finished_at: matchComplete ? new Date().toISOString() : null,
    })
    .eq("id", gameId);

  if (sessionError) {
    return { error: sessionError.message };
  }

  return {};
}
