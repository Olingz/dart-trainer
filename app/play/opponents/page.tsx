import Link from "next/link";
import { redirect } from "next/navigation";

import { LocalOpponentsManager } from "@/components/local-opponents-manager";
import { createClient } from "@/lib/supabase/server";

export default async function OpponentsPage() {
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
          href="/play/new"
          className="text-sm font-medium text-dart-muted underline active:text-dart-cream"
        >
          ← Tilbage til nyt spil
        </Link>

        <header>
          <h1 className="font-display text-2xl text-dart-cream">Modstandere</h1>
          <p className="mt-1 text-sm text-dart-muted">
            Gem navne — vælg dem når du starter et spil
          </p>
        </header>

        <LocalOpponentsManager opponents={opponents ?? []} />

        <Link
          href="/play/new"
          className="font-display min-h-12 flex items-center justify-center rounded-xl border-2 border-dart-cream bg-dart-green text-xl text-dart-cream"
        >
          Fortsæt til nyt spil
        </Link>
      </div>
    </div>
  );
}
