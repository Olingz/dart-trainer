"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  dartInputToDbRow,
  validateDartInput,
  validateVisitDarts,
  type DartInput,
} from "@/lib/dart-score";
import { evaluateVisit } from "@/lib/game-rules";
import {
  applyLegWinToPlayers,
  nextPlayer,
  selfPlayer,
  sortPlayers,
  type GamePlayerState,
} from "@/lib/multiplayer";
import {
  validateGameSetup,
  type GameSetupInput,
} from "@/lib/match-config";
import { recalculateGameSession } from "@/lib/recalculate-game";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { error?: string };

function selfDisplayName(
  profile: { display_name: string | null } | null,
  email: string | undefined,
): string {
  const fromProfile = profile?.display_name?.trim();
  if (fromProfile) return fromProfile;
  if (email) return email.split("@")[0] ?? "Dig";
  return "Dig";
}

async function persistPlayers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  players: GamePlayerState[],
): Promise<{ error?: string }> {
  for (const player of players) {
    const { error } = await supabase
      .from("game_players")
      .update({
        current_score: player.current_score,
        sets_won: player.sets_won,
        legs_won: player.legs_won,
      })
      .eq("id", player.id);

    if (error) {
      return { error: error.message };
    }
  }
  return {};
}

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

  const uniqueOpponentIds = [...new Set(setup.opponentIds)];

  const { data: opponents, error: opponentsError } =
    uniqueOpponentIds.length > 0
      ? await supabase
          .from("local_opponents")
          .select("id, name")
          .eq("user_id", user.id)
          .in("id", uniqueOpponentIds)
      : { data: [], error: null };

  if (opponentsError) {
    return { error: opponentsError.message };
  }

  if ((opponents?.length ?? 0) !== uniqueOpponentIds.length) {
    return { error: "En eller flere modstandere blev ikke fundet" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  const { data: session, error } = await supabase
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

  if (error || !session) {
    return { error: error?.message ?? "Kunne ikke oprette spil" };
  }

  const opponentRows = (opponents ?? []).sort(
    (a, b) =>
      uniqueOpponentIds.indexOf(a.id) - uniqueOpponentIds.indexOf(b.id),
  );

  const playerRows = [
    {
      game_session_id: session.id,
      display_name: selfDisplayName(profile, user.email),
      player_order: 0,
      is_self: true,
      current_score: setup.startScore,
    },
    ...opponentRows.map((opponent, index) => ({
      game_session_id: session.id,
      display_name: opponent.name,
      player_order: index + 1,
      is_self: false,
      local_opponent_id: opponent.id,
      current_score: setup.startScore,
    })),
  ];

  const { data: players, error: playersError } = await supabase
    .from("game_players")
    .insert(playerRows)
    .select("id, player_order, is_self");

  if (playersError || !players?.length) {
    await supabase.from("game_sessions").delete().eq("id", session.id);
    return { error: playersError?.message ?? "Kunne ikke oprette spillere" };
  }

  const firstPlayer =
    [...players].sort((a, b) => a.player_order - b.player_order)[0];

  await supabase
    .from("game_sessions")
    .update({ active_player_id: firstPlayer.id })
    .eq("id", session.id);

  redirect(`/game/${session.id}`);
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
      "id, user_id, current_score, start_score, status, checkout_mode, legs_to_win, sets_to_win, sets_won, legs_won, current_set, current_leg, active_player_id",
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

  const { data: playerRows, error: playersError } = await supabase
    .from("game_players")
    .select(
      "id, display_name, player_order, is_self, current_score, sets_won, legs_won",
    )
    .eq("game_session_id", gameId)
    .order("player_order", { ascending: true });

  if (playersError) {
    return { error: playersError.message };
  }

  const hasPlayers = (playerRows?.length ?? 0) > 0;
  const activePlayerId =
    game.active_player_id ?? playerRows?.[0]?.id ?? null;

  if (hasPlayers && !activePlayerId) {
    return { error: "Ingen aktiv spiller" };
  }

  const activeDbPlayer = playerRows?.find((p) => p.id === activePlayerId);
  const scoreBefore = hasPlayers
    ? activeDbPlayer?.current_score ?? game.start_score
    : game.current_score;

  const { count } = await supabase
    .from("rounds")
    .select("id", { count: "exact", head: true })
    .eq("game_session_id", gameId);

  const roundNumber = (count ?? 0) + 1;
  const result = evaluateVisit(scoreBefore, darts, game.checkout_mode);

  if (!result) {
    return { error: "Turen er ikke afsluttet endnu" };
  }

  const { data: round, error: roundError } = await supabase
    .from("rounds")
    .insert({
      game_session_id: gameId,
      game_player_id: activePlayerId,
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

  const sessionUpdate: Record<string, unknown> = {};

  if (hasPlayers && activePlayerId && playerRows) {
    let players: GamePlayerState[] = playerRows.map((p) => ({
      id: p.id,
      display_name: p.display_name,
      player_order: p.player_order,
      is_self: p.is_self,
      current_score:
        p.id === activePlayerId ? result.scoreAfter : p.current_score,
      sets_won: p.sets_won,
      legs_won: p.legs_won,
    }));

    let nextActiveId = activePlayerId;
    let matchComplete = false;
    let winnerId: string | null = null;
    let currentSet = game.current_set;
    let currentLeg = game.current_leg;

    if (result.isWin) {
      const leg = applyLegWinToPlayers(
        players,
        activePlayerId,
        game.start_score,
        {
          legsToWin: game.legs_to_win,
          setsToWin: game.sets_to_win,
        },
        { currentSet, currentLeg },
      );
      players = leg.players;
      matchComplete = leg.matchComplete;
      winnerId = leg.winnerId;
      currentSet = leg.currentSet;
      currentLeg = leg.currentLeg;
      nextActiveId = sortPlayers(players)[0].id;
    } else {
      nextActiveId = nextPlayer(players, activePlayerId).id;
    }

    const persist = await persistPlayers(supabase, players);
    if (persist.error) {
      return persist;
    }

    const nextActive = players.find((p) => p.id === nextActiveId) ?? players[0];
    const self = selfPlayer(players);

    sessionUpdate.current_score = nextActive.current_score;
    sessionUpdate.active_player_id = nextActiveId;
    sessionUpdate.sets_won = self?.sets_won ?? 0;
    sessionUpdate.legs_won = self?.legs_won ?? 0;
    sessionUpdate.current_set = currentSet;
    sessionUpdate.current_leg = currentLeg;
    sessionUpdate.winner_player_id = winnerId;

    if (matchComplete) {
      sessionUpdate.status = "completed";
      sessionUpdate.finished_at = new Date().toISOString();
    }
  } else {
    sessionUpdate.current_score = result.scoreAfter;

    if (result.isWin) {
      const { advanceAfterLegWin } = await import("@/lib/game-rules");
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
