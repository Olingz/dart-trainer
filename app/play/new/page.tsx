import Link from "next/link";
import { redirect } from "next/navigation";

import { GameSetupWizard } from "@/components/game-setup-wizard";
import { createClient } from "@/lib/supabase/server";

export default async function NewGamePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: opponents } = await supabase
    .from("local_opponents")
    .select("id, name")
    .order("name", { ascending: true });

  return (
    <div className="flex min-h-full flex-1 flex-col px-4 py-6">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6">
        <Link
          href="/"
          className="text-sm font-medium text-dart-muted underline active:text-dart-cream"
        >
          ← Forside
        </Link>

        <header>
          <h1 className="font-display text-2xl text-dart-cream">Nyt spil</h1>
          <p className="mt-1 text-sm text-dart-muted">Fire korte trin</p>
        </header>

        <GameSetupWizard opponents={opponents ?? []} />
      </div>
    </div>
  );
}
