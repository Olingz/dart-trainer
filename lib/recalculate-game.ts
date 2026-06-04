import type { SupabaseClient } from "@supabase/supabase-js";

import { dartThrowRowToInput, type DartInput } from "@/lib/dart-score";
import { evaluateVisit } from "@/lib/game-rules";
import type { CheckoutMode } from "@/lib/match-config";
import {
  applyLegWinToPlayers,
  nextPlayer,
  selfPlayer,
  sortPlayers,
  type GamePlayerState,
} from "@/lib/multiplayer";

type RoundThrowRow = {
  throw_number: number;
  points: number;
  segment: number | null;
  multiplier: number;
  is_miss: boolean;
  is_bull: boolean;
};

type RoundRow = {
  id: string;
  round_number: number;
  game_player_id: string | null;
  dart_throws: RoundThrowRow[];
};

function throwToInput(row: RoundThrowRow): DartInput {
  return dartThrowRowToInput({ ...row, id: "" });
}

type SessionFormat = {
  start_score: number;
  checkout_mode: CheckoutMode;
  legs_to_win: number;
  sets_to_win: number;
};

async function persistPlayers(
  supabase: SupabaseClient,
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

export async function recalculateGameSession(
  supabase: SupabaseClient,
  gameId: string,
  format: SessionFormat,
): Promise<{ error?: string }> {
  const { data: playerRows, error: playersError } = await supabase
    .from("game_players")
    .select(
      "id, display_name, player_order, is_self, is_bot, bot_difficulty, current_score, sets_won, legs_won",
    )
    .eq("game_session_id", gameId)
    .order("player_order", { ascending: true });

  if (playersError) {
    return { error: playersError.message };
  }

  const { data: rounds, error: roundsError } = await supabase
    .from("rounds")
    .select(
      `
      id,
      round_number,
      game_player_id,
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

  if (!playerRows?.length) {
    return recalculateLegacySession(supabase, gameId, format, rounds ?? []);
  }

  let players: GamePlayerState[] = playerRows.map((p) => ({
    id: p.id,
    display_name: p.display_name,
    player_order: p.player_order,
    is_self: p.is_self,
    is_bot: p.is_bot ?? false,
    bot_difficulty: p.bot_difficulty ?? null,
    current_score: format.start_score,
    sets_won: 0,
    legs_won: 0,
  }));

  let global = { currentSet: 1, currentLeg: 1 };
  let matchComplete = false;
  let winnerId: string | null = null;
  let activePlayerId = players[0].id;

  for (const round of (rounds ?? []) as RoundRow[]) {
    const playerId =
      round.game_player_id ?? players[0].id;
    const playerIndex = players.findIndex((p) => p.id === playerId);
    if (playerIndex < 0) {
      return { error: "Runde uden gyldig spiller" };
    }

    const darts = [...(round.dart_throws ?? [])]
      .sort((a, b) => a.throw_number - b.throw_number)
      .map(throwToInput);

    const active = players[playerIndex];
    const result = evaluateVisit(
      active.current_score,
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
        game_player_id: playerId,
      })
      .eq("id", round.id);

    if (roundUpdateError) {
      return { error: roundUpdateError.message };
    }

    if (result.isWin) {
      const leg = applyLegWinToPlayers(
        players,
        playerId,
        format.start_score,
        {
          legsToWin: format.legs_to_win,
          setsToWin: format.sets_to_win,
        },
        global,
      );
      players = leg.players;
      global = {
        currentSet: leg.currentSet,
        currentLeg: leg.currentLeg,
      };
      matchComplete = leg.matchComplete;
      winnerId = leg.winnerId;
      activePlayerId = sortPlayers(players)[0].id;
    } else {
      players = players.map((p) =>
        p.id === playerId
          ? { ...p, current_score: result.scoreAfter }
          : p,
      );
      activePlayerId = nextPlayer(players, playerId).id;
    }
  }

  const persist = await persistPlayers(supabase, players);
  if (persist.error) {
    return persist;
  }

  const active = players.find((p) => p.id === activePlayerId) ?? players[0];
  const self = selfPlayer(players);

  const { error: sessionError } = await supabase
    .from("game_sessions")
    .update({
      current_score: active.current_score,
      sets_won: self?.sets_won ?? 0,
      legs_won: self?.legs_won ?? 0,
      current_set: global.currentSet,
      current_leg: global.currentLeg,
      active_player_id: activePlayerId,
      winner_player_id: winnerId,
      status: matchComplete ? "completed" : "in_progress",
      finished_at: matchComplete ? new Date().toISOString() : null,
    })
    .eq("id", gameId);

  if (sessionError) {
    return { error: sessionError.message };
  }

  return {};
}

async function recalculateLegacySession(
  supabase: SupabaseClient,
  gameId: string,
  format: SessionFormat,
  rounds: RoundRow[],
): Promise<{ error?: string }> {
  const { advanceAfterLegWin } = await import("@/lib/game-rules");

  let current = format.start_score;
  let counters = {
    setsWon: 0,
    legsWon: 0,
    currentSet: 1,
    currentLeg: 1,
  };
  let matchComplete = false;

  for (const round of rounds) {
    const darts = [...(round.dart_throws ?? [])]
      .sort((a, b) => a.throw_number - b.throw_number)
      .map(throwToInput);

    const result = evaluateVisit(current, darts, format.checkout_mode);

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
