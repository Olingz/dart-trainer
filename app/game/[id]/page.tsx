import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { GamePlay } from "@/app/game/[id]/game-play";
import type { GamePlayerState } from "@/lib/multiplayer";
import { createClient } from "@/lib/supabase/server";

export default async function GamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: game, error } = await supabase
    .from("game_sessions")
    .select(
      "id, start_score, current_score, status, user_id, checkout_mode, legs_to_win, sets_to_win, sets_won, legs_won, current_set, current_leg, active_player_id, winner_player_id",
    )
    .eq("id", id)
    .single();

  if (error || !game) {
    notFound();
  }

  if (game.user_id !== user.id) {
    notFound();
  }

  const { data: playerRows } = await supabase
    .from("game_players")
    .select(
      "id, display_name, player_order, is_self, is_bot, bot_difficulty, current_score, sets_won, legs_won",
    )
    .eq("game_session_id", id)
    .order("player_order", { ascending: true });

  const players: GamePlayerState[] = (playerRows ?? []).map((p) => ({
    id: p.id,
    display_name: p.display_name,
    player_order: p.player_order,
    is_self: p.is_self,
    is_bot: p.is_bot ?? false,
    bot_difficulty: p.bot_difficulty ?? null,
    current_score: p.current_score,
    sets_won: p.sets_won,
    legs_won: p.legs_won,
  }));

  const playerNameById = new Map(
    players.map((p) => [p.id, p.display_name] as const),
  );

  const { data: rounds } = await supabase
    .from("rounds")
    .select(
      `
      id,
      round_number,
      points_scored,
      score_after,
      is_bust,
      game_player_id,
      dart_throws (
        id,
        throw_number,
        points,
        segment,
        multiplier,
        is_miss,
        is_bull
      )
    `,
    )
    .eq("game_session_id", id)
    .order("round_number", { ascending: true });

  return (
    <div className="flex min-h-full flex-1 flex-col px-4 py-6">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-4">
        <Link
          href="/"
          className="text-sm font-medium text-dart-muted underline active:text-dart-cream"
        >
          ← Forside
        </Link>
        <GamePlay
          game={game}
          players={players}
          rounds={(rounds ?? []).map((round) => ({
            ...round,
            player_name: round.game_player_id
              ? (playerNameById.get(round.game_player_id) ?? null)
              : null,
            dart_throws: round.dart_throws ?? [],
          }))}
        />
      </div>
    </div>
  );
}
