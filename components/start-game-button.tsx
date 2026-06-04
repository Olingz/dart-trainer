"use client";

import { useTransition } from "react";

import { createGame301 } from "@/app/game/actions";

export function StartGameButton() {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => createGame301())}
      className="font-display min-h-14 w-full rounded-xl border-2 border-dart-cream bg-dart-green px-4 text-2xl text-dart-cream shadow-[0_0_0_2px_var(--dart-red)] transition-opacity disabled:opacity-50 active:bg-dart-green/90"
    >
      {pending ? "Starter…" : "Nyt 301-spil"}
    </button>
  );
}
