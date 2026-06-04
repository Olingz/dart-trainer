import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { GamePlay } from "@/app/game/[id]/game-play";
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
      "id, start_score, current_score, status, user_id, checkout_mode, legs_to_win, sets_to_win, sets_won, legs_won, current_set, current_leg",
    )
    .eq("id", id)
    .single();

  if (error || !game) {
    notFound();
  }

  if (game.user_id !== user.id) {
    notFound();
  }

  const { data: rounds } = await supabase
    .from("rounds")
    .select(
      `
      id,
      round_number,
      points_scored,
      score_after,
      is_bust,
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
          rounds={(rounds ?? []).map((round) => ({
            ...round,
            dart_throws: round.dart_throws ?? [],
          }))}
        />
      </div>
    </div>
  );
}
