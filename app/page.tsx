import Link from "next/link";

import { StartGameButton } from "@/components/start-game-button";
import { SignOutButton } from "@/components/sign-out-button";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: activeGame } = await supabase
    .from("game_sessions")
    .select("id, current_score, start_score, started_at")
    .eq("status", "in_progress")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="flex min-h-full flex-1 flex-col px-4 py-8">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6">
        <header className="text-center">
          <p className="font-display text-2xl tracking-widest text-dart-red">301</p>
          <h1 className="font-display mt-0 text-4xl leading-none text-dart-cream">
            Dart Trainer
          </h1>
          <p className="mt-2 text-base text-dart-muted">
            Træning ved skiven
          </p>
        </header>

        {activeGame && (
          <Link
            href={`/game/${activeGame.id}`}
            className="dart-score-card block rounded-2xl bg-dart-cream p-4 transition-opacity active:opacity-90"
          >
            <p className="text-sm font-bold uppercase tracking-wide text-dart-green">
              Fortsæt spil
            </p>
            <p className="font-display mt-1 text-5xl leading-none tabular-nums text-dart-black">
              {activeGame.current_score}
            </p>
            <p className="mt-1 text-sm text-dart-wire">
              resterende af {activeGame.start_score}
            </p>
          </Link>
        )}

        <StartGameButton />

        <Link
          href="/stats"
          className="flex min-h-12 items-center justify-center rounded-xl border-2 border-dart-wire px-4 text-base font-medium text-dart-cream transition-colors active:border-dart-cream"
        >
          Statistik
        </Link>

        <section className="dart-panel rounded-xl p-4">
          <p className="text-sm text-dart-muted">Logget ind som</p>
          <p className="mt-1 text-base font-medium break-all text-dart-cream">
            {user?.email}
          </p>
        </section>

        <p className="text-center text-xs text-dart-muted">
          Tryk tal = single · Double/Triple før felt · Bust ved 1 eller under 0
        </p>

        <div className="mt-auto">
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
