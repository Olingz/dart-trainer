"use client";

import { useState, useTransition } from "react";

import { createGame } from "@/app/game/actions";
import {
  DEFAULT_GAME_SETUP,
  type CheckoutMode,
  type GameSetupInput,
} from "@/lib/match-config";

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="dart-panel rounded-xl p-4">
      <p className="text-sm font-medium text-dart-cream">{label}</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          disabled={disabled || value <= min}
          onClick={() => onChange(value - 1)}
          className="font-display flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border-2 border-dart-wire text-2xl text-dart-cream disabled:opacity-40"
          aria-label={`Færre ${label}`}
        >
          −
        </button>
        <span className="font-display text-4xl tabular-nums text-dart-cream">
          {value}
        </span>
        <button
          type="button"
          disabled={disabled || value >= max}
          onClick={() => onChange(value + 1)}
          className="font-display flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border-2 border-dart-wire text-2xl text-dart-cream disabled:opacity-40"
          aria-label={`Flere ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

export function GameSetupForm() {
  const [pending, startTransition] = useTransition();
  const [setup, setSetup] = useState<GameSetupInput>(DEFAULT_GAME_SETUP);
  const [error, setError] = useState<string | null>(null);

  function startGame() {
    setError(null);
    startTransition(async () => {
      const result = await createGame(setup);
      if (result?.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="dart-panel rounded-xl p-4">
        <p className="text-sm font-medium text-dart-cream">Spiltype</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {([301, 501] as const).map((score) => (
            <button
              key={score}
              type="button"
              disabled={pending}
              onClick={() =>
                setSetup((s) => ({ ...s, startScore: score }))
              }
              className={`font-display min-h-14 rounded-xl border-2 text-2xl transition-colors ${
                setup.startScore === score
                  ? "border-dart-cream bg-dart-green text-dart-cream"
                  : "border-dart-wire text-dart-muted active:border-dart-cream"
              }`}
            >
              {score}
            </button>
          ))}
        </div>
      </div>

      <Stepper
        label="Sets til at vinde kampen"
        value={setup.setsToWin}
        min={1}
        max={11}
        disabled={pending}
        onChange={(setsToWin) => setSetup((s) => ({ ...s, setsToWin }))}
      />

      <Stepper
        label="Legs til at vinde et set"
        value={setup.legsToWin}
        min={1}
        max={11}
        disabled={pending}
        onChange={(legsToWin) => setSetup((s) => ({ ...s, legsToWin }))}
      />

      <div className="dart-panel rounded-xl p-4">
        <p className="text-sm font-medium text-dart-cream">Checkout</p>
        <div className="mt-3 flex flex-col gap-2">
          {(
            [
              { mode: "straight" as CheckoutMode, title: "Straight out", sub: "Ethvert kast der rammer 0" },
              { mode: "double" as CheckoutMode, title: "Double out", sub: "Skal slutte på double eller bull 50" },
            ] as const
          ).map(({ mode, title, sub }) => (
            <button
              key={mode}
              type="button"
              disabled={pending}
              onClick={() => setSetup((s) => ({ ...s, checkoutMode: mode }))}
              className={`rounded-xl border-2 px-4 py-3 text-left transition-colors ${
                setup.checkoutMode === mode
                  ? "border-dart-cream bg-dart-green/30"
                  : "border-dart-wire active:border-dart-cream"
              }`}
            >
              <p className="font-medium text-dart-cream">{title}</p>
              <p className="text-xs text-dart-muted">{sub}</p>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-dart-red bg-dart-red/15 px-3 py-2 text-sm text-dart-red">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={pending}
        onClick={startGame}
        className="font-display min-h-14 w-full rounded-xl border-2 border-dart-cream bg-dart-green px-4 text-2xl text-dart-cream shadow-[0_0_0_2px_var(--dart-red)] transition-opacity disabled:opacity-50 active:bg-dart-green/90"
      >
        {pending ? "Starter…" : `Start ${setup.startScore}`}
      </button>
    </div>
  );
}
