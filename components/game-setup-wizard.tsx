"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { createGame } from "@/app/game/actions";
import type { LocalOpponent } from "@/components/local-opponents-manager";
import { SetupStepHeader } from "@/components/setup-step-header";
import { FORMAT_PRESETS, type FormatPresetId } from "@/lib/format-presets";
import {
  BOT_DIFFICULTIES,
  botDifficultyDescription,
  botDisplayName,
} from "@/lib/bot";
import {
  checkoutModeLabel,
  DEFAULT_GAME_SETUP,
  formatMatchRules,
  type BotDifficulty,
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
    <div className="mt-4 rounded-xl border border-dart-wire/50 p-4">
      <p className="text-sm font-medium text-dart-cream">{label}</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          disabled={disabled || value <= min}
          onClick={() => onChange(value - 1)}
          className="font-display flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-2 border-dart-wire text-xl text-dart-cream disabled:opacity-40"
        >
          −
        </button>
        <span className="font-display text-3xl tabular-nums text-dart-cream">
          {value}
        </span>
        <button
          type="button"
          disabled={disabled || value >= max}
          onClick={() => onChange(value + 1)}
          className="font-display flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-2 border-dart-wire text-xl text-dart-cream disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  );
}

function NavButtons({
  onBack,
  onNext,
  nextLabel = "Næste",
  pending,
  showBack = true,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  pending?: boolean;
  showBack?: boolean;
}) {
  return (
    <div className="flex gap-3 pt-2">
      {showBack && onBack && (
        <button
          type="button"
          disabled={pending}
          onClick={onBack}
          className="min-h-12 flex-1 rounded-xl border-2 border-dart-wire text-base font-medium text-dart-cream disabled:opacity-50"
        >
          Tilbage
        </button>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={onNext}
        className="font-display min-h-12 flex-[2] rounded-xl border-2 border-dart-cream bg-dart-green text-xl text-dart-cream disabled:opacity-50"
      >
        {nextLabel}
      </button>
    </div>
  );
}

export function GameSetupWizard({
  opponents,
}: {
  opponents: LocalOpponent[];
}) {
  const [step, setStep] = useState(1);
  const [pending, startTransition] = useTransition();
  const [setup, setSetup] = useState<GameSetupInput>(DEFAULT_GAME_SETUP);
  const [formatPreset, setFormatPreset] = useState<FormatPresetId>("single");
  const [error, setError] = useState<string | null>(null);

  const playerCount =
    1 + setup.opponentIds.length + (setup.botDifficulty ? 1 : 0);

  function selectSolo() {
    setSetup((s) => ({ ...s, opponentIds: [], botDifficulty: null }));
  }

  function selectBot(difficulty: BotDifficulty) {
    setSetup((s) => ({
      ...s,
      botDifficulty: difficulty,
      opponentIds: [],
    }));
  }

  function toggleOpponent(id: string) {
    setSetup((s) => {
      if (s.opponentIds.includes(id)) {
        return {
          ...s,
          botDifficulty: null,
          opponentIds: s.opponentIds.filter((oid) => oid !== id),
        };
      }
      if (s.opponentIds.length >= 5) return s;
      return {
        ...s,
        botDifficulty: null,
        opponentIds: [...s.opponentIds, id],
      };
    });
  }

  function applyPreset(id: Exclude<FormatPresetId, "custom">) {
    const preset = FORMAT_PRESETS[id];
    setFormatPreset(id);
    setSetup((s) => ({
      ...s,
      setsToWin: preset.setsToWin,
      legsToWin: preset.legsToWin,
    }));
  }

  function startGame() {
    setError(null);
    startTransition(async () => {
      const result = await createGame(setup);
      if (result?.error) {
        setError(result.error);
      }
    });
  }

  const summaryRules = formatMatchRules({
    start_score: setup.startScore,
    checkout_mode: setup.checkoutMode,
    legs_to_win: setup.legsToWin,
    sets_to_win: setup.setsToWin,
  });

  return (
    <div className="flex flex-col gap-6">
      <SetupStepHeader step={step} />

      {step === 1 && (
        <section className="dart-panel rounded-xl p-4">
          <h2 className="font-display text-xl text-dart-cream">Vælg spil</h2>
          <p className="mt-1 text-sm text-dart-muted">Startscore for legen</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {([301, 501] as const).map((score) => (
              <button
                key={score}
                type="button"
                disabled={pending}
                onClick={() => setSetup((s) => ({ ...s, startScore: score }))}
                className={`font-display min-h-20 rounded-xl border-2 text-3xl transition-colors ${
                  setup.startScore === score
                    ? "border-dart-cream bg-dart-green text-dart-cream"
                    : "border-dart-wire text-dart-muted"
                }`}
              >
                {score}
              </button>
            ))}
          </div>
          <NavButtons
            showBack={false}
            onNext={() => setStep(2)}
            pending={pending}
          />
        </section>
      )}

      {step === 2 && (
        <section className="dart-panel rounded-xl p-4">
          <h2 className="font-display text-xl text-dart-cream">Hvem spiller?</h2>
          <p className="mt-1 text-sm text-dart-muted">
            {playerCount === 1
              ? "Kun dig ved skiven"
              : `${playerCount} spillere ved skiven`}
          </p>

          <button
            type="button"
            disabled={pending}
            onClick={selectSolo}
            className={`mt-4 w-full rounded-xl border-2 px-4 py-3 text-left ${
              setup.opponentIds.length === 0 && !setup.botDifficulty
                ? "border-dart-cream bg-dart-green/30"
                : "border-dart-wire"
            }`}
          >
            <p className="font-medium text-dart-cream">Kun mig</p>
            <p className="text-xs text-dart-muted">Solo træning</p>
          </button>

          <div className="mt-4">
            <p className="text-sm font-medium text-dart-cream">Mod bot</p>
            <div className="mt-2 flex flex-col gap-2">
              {BOT_DIFFICULTIES.map((difficulty) => (
                <button
                  key={difficulty}
                  type="button"
                  disabled={pending}
                  onClick={() => selectBot(difficulty)}
                  className={`rounded-xl border-2 px-4 py-3 text-left ${
                    setup.botDifficulty === difficulty
                      ? "border-dart-cream bg-dart-green/30"
                      : "border-dart-wire"
                  }`}
                >
                  <p className="font-medium text-dart-cream">
                    {botDisplayName(difficulty)}
                  </p>
                  <p className="text-xs text-dart-muted">
                    {botDifficultyDescription(difficulty)}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {opponents.length > 0 ? (
            <div className="mt-4">
              <p className="text-sm font-medium text-dart-cream">Modstandere</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {opponents.map((opponent) => {
                  const selected = setup.opponentIds.includes(opponent.id);
                  return (
                    <button
                      key={opponent.id}
                      type="button"
                      disabled={pending}
                      onClick={() => toggleOpponent(opponent.id)}
                      className={`rounded-full border-2 px-4 py-2 text-sm font-medium ${
                        selected
                          ? "border-dart-cream bg-dart-green text-dart-cream"
                          : "border-dart-wire text-dart-muted"
                      }`}
                    >
                      {opponent.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-dart-muted">
              Du har ingen gemte modstandere endnu.
            </p>
          )}

          <Link
            href="/play/opponents"
            className="mt-4 block text-center text-sm text-dart-muted underline"
          >
            Administrer modstandere
          </Link>

          <NavButtons
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
            pending={pending}
          />
        </section>
      )}

      {step === 3 && (
        <section className="dart-panel rounded-xl p-4">
          <h2 className="font-display text-xl text-dart-cream">Kampformat</h2>
          <p className="mt-1 text-sm text-dart-muted">Sets og legs</p>

          <div className="mt-4 flex flex-col gap-2">
            {(
              Object.entries(FORMAT_PRESETS) as [
                Exclude<FormatPresetId, "custom">,
                (typeof FORMAT_PRESETS)["single"],
              ][]
            ).map(([id, preset]) => (
              <button
                key={id}
                type="button"
                disabled={pending}
                onClick={() => applyPreset(id)}
                className={`rounded-xl border-2 px-4 py-3 text-left ${
                  formatPreset === id
                    ? "border-dart-cream bg-dart-green/30"
                    : "border-dart-wire"
                }`}
              >
                <p className="font-medium text-dart-cream">{preset.label}</p>
                <p className="text-xs text-dart-muted">{preset.description}</p>
              </button>
            ))}
            <button
              type="button"
              disabled={pending}
              onClick={() => setFormatPreset("custom")}
              className={`rounded-xl border-2 px-4 py-3 text-left ${
                formatPreset === "custom"
                  ? "border-dart-cream bg-dart-green/30"
                  : "border-dart-wire"
              }`}
            >
              <p className="font-medium text-dart-cream">Tilpas</p>
              <p className="text-xs text-dart-muted">Vælg selv antal set og legs</p>
            </button>
          </div>

          {formatPreset === "custom" && (
            <>
              <Stepper
                label="Sets til at vinde"
                value={setup.setsToWin}
                min={1}
                max={11}
                disabled={pending}
                onChange={(setsToWin) =>
                  setSetup((s) => ({ ...s, setsToWin }))
                }
              />
              <Stepper
                label="Legs per set"
                value={setup.legsToWin}
                min={1}
                max={11}
                disabled={pending}
                onChange={(legsToWin) =>
                  setSetup((s) => ({ ...s, legsToWin }))
                }
              />
            </>
          )}

          <NavButtons
            onBack={() => setStep(2)}
            onNext={() => setStep(4)}
            pending={pending}
          />
        </section>
      )}

      {step === 4 && (
        <section className="dart-panel rounded-xl p-4">
          <h2 className="font-display text-xl text-dart-cream">Klar til start</h2>
          <p className="mt-1 text-sm text-dart-muted">Checkout og oversigt</p>

          <div className="mt-4 flex flex-col gap-2">
            {(
              [
                {
                  mode: "straight" as CheckoutMode,
                  title: "Straight out",
                  sub: "Ethvert kast der rammer 0",
                },
                {
                  mode: "double" as CheckoutMode,
                  title: "Double out",
                  sub: "Double eller bull 50",
                },
              ] as const
            ).map(({ mode, title, sub }) => (
              <button
                key={mode}
                type="button"
                disabled={pending}
                onClick={() => setSetup((s) => ({ ...s, checkoutMode: mode }))}
                className={`rounded-xl border-2 px-4 py-3 text-left ${
                  setup.checkoutMode === mode
                    ? "border-dart-cream bg-dart-green/30"
                    : "border-dart-wire"
                }`}
              >
                <p className="font-medium text-dart-cream">{title}</p>
                <p className="text-xs text-dart-muted">{sub}</p>
              </button>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-dart-wire/50 bg-dart-black/40 px-4 py-3 text-sm">
            <p className="text-dart-cream">
              <strong>{setup.startScore}</strong>
              {setup.botDifficulty && (
                <> · {botDisplayName(setup.botDifficulty)}</>
              )}
              {setup.opponentIds.length > 0 && (
                <> · {playerCount} spillere</>
              )}
              {!setup.botDifficulty && setup.opponentIds.length === 0 && (
                <> · solo</>
              )}
            </p>
            <p className="mt-1 text-dart-muted">{summaryRules}</p>
            <p className="mt-1 text-dart-muted">
              {checkoutModeLabel(setup.checkoutMode)}
            </p>
          </div>

          {error && (
            <p className="mt-3 rounded-lg border border-dart-red bg-dart-red/15 px-3 py-2 text-sm text-dart-red">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              disabled={pending}
              onClick={() => setStep(3)}
              className="min-h-12 flex-1 rounded-xl border-2 border-dart-wire text-base font-medium text-dart-cream disabled:opacity-50"
            >
              Tilbage
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={startGame}
              className="font-display min-h-12 flex-[2] rounded-xl border-2 border-dart-cream bg-dart-green text-xl text-dart-cream shadow-[0_0_0_2px_var(--dart-red)] disabled:opacity-50"
            >
              {pending ? "Starter…" : "Start spil"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
