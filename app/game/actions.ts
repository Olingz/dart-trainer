"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  dartInputToDbRow,
  validateDartInput,
  validateVisitDarts,
  type DartInput,
} from "@/lib/dart-score";
import { evaluateVisit } from "@/lib/game301";
import { recalculateGameSession } from "@/lib/recalculate-game";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { error?: string };

export async function createGame301(): Promise<void> {
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
      start_score: 301,
      current_score: 301,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
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
    .select("id, user_id, current_score, status")
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
  const result = evaluateVisit(game.current_score, darts);

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
      score_after: result.scoreAfter,
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

  const sessionUpdate: {
    current_score: number;
    status?: "completed";
    finished_at?: string;
  } = {
    current_score: result.scoreAfter,
  };

  if (result.isWin) {
    sessionUpdate.status = "completed";
    sessionUpdate.finished_at = new Date().toISOString();
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
    .select("id, user_id, start_score, status")
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

  const recalc = await recalculateGameSession(
    supabase,
    gameId,
    session.start_score,
  );

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
