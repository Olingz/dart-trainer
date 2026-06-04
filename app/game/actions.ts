"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  dartInputToDbRow,
  validateDartInput,
  validateVisitDarts,
  type DartInput,
} from "@/lib/dart-score";
import { advanceAfterLegWin, evaluateVisit } from "@/lib/game-rules";
import {
  validateGameSetup,
  type GameSetupInput,
} from "@/lib/match-config";
import { recalculateGameSession } from "@/lib/recalculate-game";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { error?: string };

export async function createGame(
  setup: GameSetupInput,
): Promise<ActionResult> {
  const validationError = validateGameSetup(setup);
  if (validationError) {
    return { error: validationError };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("game_sessions")
    .insert({
      user_id: user.id,
      start_score: setup.startScore,
      current_score: setup.startScore,
      checkout_mode: setup.checkoutMode,
      legs_to_win: setup.legsToWin,
      sets_to_win: setup.setsToWin,
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  redirect(`/game/${data.id}`);
}

export async function submitRound(
  gameId: string,
  darts: DartInput[],
): Promise<ActionResult> {
  const validationError = validateVisitDarts(darts);
  if (validationError) {
    return { error: validationError };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Ikke logget ind" };
  }

  const { data: game, error: gameError } = await supabase
    .from("game_sessions")
    .select(
      "id, user_id, current_score, start_score, status, checkout_mode, legs_to_win, sets_to_win, sets_won, legs_won, current_set, current_leg",
    )
    .eq("id", gameId)
    .single();

  if (gameError || !game) {
    return { error: "Spil ikke fundet" };
  }

  if (game.user_id !== user.id) {
    return { error: "Ingen adgang til dette spil" };
  }

  if (game.status !== "in_progress") {
    return { error: "Spillet er afsluttet" };
  }

  const { count } = await supabase
    .from("rounds")
    .select("id", { count: "exact", head: true })
    .eq("game_session_id", gameId);

  const roundNumber = (count ?? 0) + 1;
  const result = evaluateVisit(
    game.current_score,
    darts,
    game.checkout_mode,
  );

  if (!result) {
    return { error: "Turen er ikke afsluttet endnu" };
  }

  const { data: round, error: roundError } = await supabase
    .from("rounds")
    .insert({
      game_session_id: gameId,
      round_number: roundNumber,
      points_scored: result.pointsScored,
      score_before: result.scoreBefore,
      score_after: result.isWin ? 0 : result.scoreAfter,
      is_bust: result.isBust,
    })
    .select("id")
    .single();

  if (roundError || !round) {
    return { error: roundError?.message ?? "Kunne ikke gemme runde" };
  }

  const throwRows = darts.map((dart, index) =>
    dartInputToDbRow(dart, round.id, index + 1),
  );

  const { error: throwsError } = await supabase
    .from("dart_throws")
    .insert(throwRows);

  if (throwsError) {
    return { error: throwsError.message };
  }

  const sessionUpdate: Record<string, unknown> = {
    current_score: result.scoreAfter,
  };

  if (result.isWin) {
    const advanced = advanceAfterLegWin(
      {
        setsWon: game.sets_won,
        legsWon: game.legs_won,
        currentSet: game.current_set,
        currentLeg: game.current_leg,
      },
      {
        legsToWin: game.legs_to_win,
        setsToWin: game.sets_to_win,
      },
    );

    sessionUpdate.sets_won = advanced.counters.setsWon;
    sessionUpdate.legs_won = advanced.counters.legsWon;
    sessionUpdate.current_set = advanced.counters.currentSet;
    sessionUpdate.current_leg = advanced.counters.currentLeg;

    if (advanced.matchComplete) {
      sessionUpdate.status = "completed";
      sessionUpdate.current_score = 0;
      sessionUpdate.finished_at = new Date().toISOString();
    } else {
      sessionUpdate.current_score = game.start_score;
    }
  }

  const { error: updateError } = await supabase
    .from("game_sessions")
    .update(sessionUpdate)
    .eq("id", gameId);

  if (updateError) {
    return { error: updateError.message };
  }

  revalidatePath(`/game/${gameId}`);
  revalidatePath("/");

  return {};
}

export async function updateDartThrow(
  throwId: string,
  gameId: string,
  dart: DartInput,
): Promise<ActionResult> {
  const validationError = validateDartInput(dart);
  if (validationError) {
    return { error: validationError };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Ikke logget ind" };
  }

  const { data: existing, error: throwError } = await supabase
    .from("dart_throws")
    .select("id, round_id")
    .eq("id", throwId)
    .single();

  if (throwError || !existing) {
    return { error: "Kast ikke fundet" };
  }

  const { data: round, error: roundError } = await supabase
    .from("rounds")
    .select("game_session_id")
    .eq("id", existing.round_id)
    .single();

  if (roundError || !round) {
    return { error: "Runde ikke fundet" };
  }

  const { data: session, error: sessionError } = await supabase
    .from("game_sessions")
    .select(
      "id, user_id, start_score, status, checkout_mode, legs_to_win, sets_to_win",
    )
    .eq("id", round.game_session_id)
    .single();

  if (sessionError || !session) {
    return { error: "Spil ikke fundet" };
  }

  if (session.id !== gameId || session.user_id !== user.id) {
    return { error: "Ingen adgang" };
  }

  if (session.status === "abandoned") {
    return { error: "Spillet er afsluttet" };
  }

  const row = dartInputToDbRow(dart, existing.round_id, 0);
  const {
    round_id: _roundId,
    throw_number: _throwNumber,
    ...updates
  } = row;

  const { error: updateError } = await supabase
    .from("dart_throws")
    .update(updates)
    .eq("id", throwId);

  if (updateError) {
    return { error: updateError.message };
  }

  const recalc = await recalculateGameSession(supabase, gameId, {
    start_score: session.start_score,
    checkout_mode: session.checkout_mode,
    legs_to_win: session.legs_to_win,
    sets_to_win: session.sets_to_win,
  });

  if (recalc.error) {
    return { error: recalc.error };
  }

  revalidatePath(`/game/${gameId}`);
  revalidatePath("/");

  return {};
}

export async function abandonGame(gameId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await supabase
    .from("game_sessions")
    .update({
      status: "abandoned",
      finished_at: new Date().toISOString(),
    })
    .eq("id", gameId)
    .eq("user_id", user.id);

  revalidatePath("/");
  redirect("/");
}
