"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { abandonGame, submitRound, updateDartThrow } from "@/app/game/actions";
import { DartInputPad } from "@/components/dart-input-pad";
import { GameStatsBar } from "@/components/game-stats-bar";
import { TripleTwentyShower } from "@/components/triple-twenty-shower";
import {
  calculateDartPoints,
  dartThrowRowToInput,
  formatDartLabel,
  isTripleTwenty,
  sumDartInputs,
  type DartInput,
  type DartThrowRow,
} from "@/lib/dart-score";
import { DARTS_PER_ROUND, evaluateVisit } from "@/lib/game301";

type Round = {
  id: string;
  round_number: number;
  points_scored: number;
  score_after: number;
  is_bust: boolean;
  dart_throws: DartThrowRow[];
};

type Game = {
  id: string;
  start_score: number;
  current_score: number;
  status: string;
};

type MultiplierMode = 1 | 2 | 3;

type EditTarget =
  | { type: "visit"; index: number }
  | {
      type: "saved";
      throwId: string;
      roundNumber: number;
      throwNumber: number;
    };

function multiplierFromDart(dart: DartInput): MultiplierMode {
  if (dart.kind === "segment") return dart.multiplier;
  if (dart.kind === "bull") return dart.multiplier;
  return 1;
}

export function GamePlay({
  game,
  rounds,
}: {
  game: Game;
  rounds: Round[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [visitDarts, setVisitDarts] = useState<DartInput[]>([]);
  const [multiplierMode, setMultiplierMode] = useState<MultiplierMode>(1);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [t20Shower, setT20Shower] = useState(false);

  useEffect(() => {
    if (!t20Shower) return;
    const timer = window.setTimeout(() => setT20Shower(false), 1200);
    return () => window.clearTimeout(timer);
  }, [t20Shower]);

  function celebrateIfT20(dart: DartInput) {
    if (isTripleTwenty(dart)) {
      setT20Shower(true);
    }
  }

  const isComplete = game.status === "completed";
  const isAbandoned = game.status === "abandoned";
  const canPlay = !isAbandoned && (!isComplete || editTarget !== null);
  const dartIndex = visitDarts.length + 1;
  const visitTotal = sumDartInputs(visitDarts);
  const visitRemaining = game.current_score - visitTotal;

  function resetMultiplier() {
    setMultiplierMode(1);
  }

  function cancelEdit() {
    setEditTarget(null);
    resetMultiplier();
    setError(null);
  }

  function startEditVisit(index: number) {
    const dart = visitDarts[index];
    if (!dart) return;
    setEditTarget({ type: "visit", index });
    setMultiplierMode(multiplierFromDart(dart));
    setError(null);
  }

  function startEditSaved(
    throwRow: DartThrowRow,
    roundNumber: number,
  ) {
    if (isAbandoned) return;
    setEditTarget({
      type: "saved",
      throwId: throwRow.id,
      roundNumber,
      throwNumber: throwRow.throw_number,
    });
    setMultiplierMode(multiplierFromDart(dartThrowRowToInput(throwRow)));
    setError(null);
  }

  function applyDart(dart: DartInput) {
    if (pending || isAbandoned) return;

    setError(null);
    celebrateIfT20(dart);

    if (editTarget?.type === "visit") {
      const next = [...visitDarts];
      next[editTarget.index] = dart;
      const outcome = evaluateVisit(game.current_score, next);
      cancelEdit();
      if (outcome) {
        submitVisit(next);
      } else {
        setVisitDarts(next);
      }
      return;
    }

    if (editTarget?.type === "saved") {
      startTransition(async () => {
        const result = await updateDartThrow(
          editTarget.throwId,
          game.id,
          dart,
        );
        if (result.error) {
          setError(result.error);
          return;
        }
        cancelEdit();
        router.refresh();
      });
      return;
    }

    if (!canPlay || visitDarts.length >= DARTS_PER_ROUND) return;

    const next = [...visitDarts, dart];
    resetMultiplier();

    const outcome = evaluateVisit(game.current_score, next);
    if (outcome) {
      submitVisit(next);
      return;
    }

    setVisitDarts(next);
  }

  function submitVisit(darts: DartInput[]) {
    startTransition(async () => {
      const result = await submitRound(game.id, darts);
      if (result.error) {
        setError(result.error);
        return;
      }
      setVisitDarts([]);
      router.refresh();
    });
  }

  function selectSegment(segment: number) {
    applyDart({ kind: "segment", segment, multiplier: multiplierMode });
  }

  function selectBull() {
    if (multiplierMode === 3) {
      setError(
        "Triple på bull findes ikke — vælg Double eller tryk Bull uden Triple",
      );
      return;
    }
    applyDart({
      kind: "bull",
      multiplier: multiplierMode === 2 ? 2 : 1,
    });
  }

  function selectMiss() {
    applyDart({ kind: "miss" });
  }

  function toggleMultiplier(mode: 2 | 3) {
    setError(null);
    setMultiplierMode((current) => (current === mode ? 1 : mode));
  }

  function undoLastDart() {
    setVisitDarts((d) => d.slice(0, -1));
    cancelEdit();
  }

  function handleAbandon() {
    if (!confirm("Afslut spillet uden at gemme som vundet?")) return;
    startTransition(() => abandonGame(game.id));
  }

  const modeHint =
    multiplierMode === 2
      ? "Double valgt — tryk et tal"
      : multiplierMode === 3
        ? "Triple valgt — tryk et tal"
        : "Tryk tal = single";

  const padTitle = editTarget
    ? editTarget.type === "visit"
      ? `Ret pil ${editTarget.index + 1} (runde ${rounds.length + 1})`
      : `Ret runde ${editTarget.roundNumber} · pil ${editTarget.throwNumber}`
    : `Pil ${dartIndex}`;

  return (
    <div className="flex flex-col gap-6">
      <TripleTwentyShower active={t20Shower} />
      {isComplete && !editTarget && (
        <div className="rounded-2xl border-2 border-dart-cream bg-dart-green px-6 py-8 text-center text-dart-cream">
          <p className="font-display text-xl tracking-wide">Spil slut</p>
          <p className="font-display mt-2 text-5xl leading-none tabular-nums">
            {game.start_score} → 0
          </p>
          <GameStatsBar
            rounds={rounds}
            currentVisitDarts={visitDarts}
            onDark={false}
          />
          <p className="mt-3 text-sm text-dart-cream/90">
            Tryk et kast nedenfor for at rette
          </p>
        </div>
      )}

      {(!isComplete || editTarget) && (
        <div className="dart-score-card rounded-2xl bg-dart-cream px-5 py-6 text-center text-dart-black">
          <p className="font-display text-xl tracking-wide text-dart-wire">
            Resterende
          </p>
          <p className="font-display mt-1 text-[5.5rem] leading-none tabular-nums text-dart-black">
            {visitRemaining}
          </p>

          <p className="mt-3 text-sm text-dart-wire">
            {editTarget
              ? "Retter kast"
              : `runde ${rounds.length + 1} · pil ${dartIndex}/${DARTS_PER_ROUND}`}
            {!isComplete && visitDarts.length > 0 && (
              <span className="text-dart-wire"> · {visitTotal} pt i turen</span>
            )}
          </p>
          <GameStatsBar rounds={rounds} currentVisitDarts={visitDarts} />
        </div>
      )}

      {!isComplete && (
        <div className="dart-panel rounded-xl p-4">
          <p className="mb-2 text-sm font-medium text-dart-muted">Denne tur</p>
          <div className="flex gap-2">
            {Array.from({ length: DARTS_PER_ROUND }, (_, i) => {
              const dart = visitDarts[i];
              const filled = dart !== undefined;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={pending || !filled}
                  onClick={() => filled && startEditVisit(i)}
                  className={`flex flex-1 flex-col items-center rounded-xl border-2 py-2 transition-colors ${
                    filled
                      ? "border-dart-wire bg-dart-cream text-dart-black"
                      : i === visitDarts.length
                        ? "border-dart-red bg-dart-red/15 text-dart-cream"
                        : "border-dart-wire/40 bg-dart-black/50 text-dart-muted"
                  }`}
                >
                  <span className="text-xs opacity-80">Pil {i + 1}</span>
                  <span className="font-display mt-1 text-lg leading-none">
                    {filled ? formatDartLabel(dart) : "—"}
                  </span>
                  {filled && (
                    <span className="text-xs tabular-nums opacity-80">
                      {calculateDartPoints(dart)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {visitDarts.length > 0 && (
            <button
              type="button"
              onClick={undoLastDart}
              disabled={pending}
              className="mt-3 w-full text-sm text-dart-muted underline"
            >
              Fortryd sidste pil
            </button>
          )}
        </div>
      )}

      {editTarget && (
        <div className="flex items-center justify-between rounded-lg border-2 border-dart-red bg-dart-red/15 px-3 py-2 text-sm text-dart-cream">
          <span>Retter kast — vælg nyt felt nedenfor</span>
          <button
            type="button"
            onClick={cancelEdit}
            className="font-bold underline"
          >
            Annuller
          </button>
        </div>
      )}

      {(canPlay || editTarget) && (
        <DartInputPad
          title={padTitle}
          hint={modeHint}
          multiplierMode={multiplierMode}
          onToggleMultiplier={toggleMultiplier}
          onSegment={selectSegment}
          onBull={selectBull}
          onMiss={selectMiss}
          disabled={pending}
          error={error}
        />
      )}

      {rounds.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-dart-muted">
            Runder {!isAbandoned && "· tryk et kast for at rette"}
          </h2>
          <ul className="flex flex-col gap-2">
            {[...rounds].reverse().map((round) => (
              <li
                key={round.id}
                className="dart-panel rounded-lg px-3 py-2 text-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="text-dart-muted">#{round.round_number}</span>
                  <span className="font-bold tabular-nums text-dart-cream">
                    {round.points_scored}
                    {round.is_bust && (
                      <span className="ml-2 text-dart-red">bust</span>
                    )}
                  </span>
                  <span className="tabular-nums text-dart-muted">
                    → {round.score_after}
                  </span>
                </div>
                {round.dart_throws.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[...round.dart_throws]
                      .sort((a, b) => a.throw_number - b.throw_number)
                      .map((dartThrow) => {
                        const isEditing =
                          editTarget?.type === "saved" &&
                          editTarget.throwId === dartThrow.id;
                        return (
                          <button
                            key={dartThrow.id}
                            type="button"
                            disabled={pending || isAbandoned}
                            onClick={() =>
                              startEditSaved(dartThrow, round.round_number)
                            }
                            className={`font-display rounded-md border-2 px-2 py-1 text-sm tabular-nums ${
                              isEditing
                                ? "border-dart-cream bg-dart-red text-dart-cream"
                                : "border-dart-wire bg-dart-black text-dart-cream active:bg-dart-wire/50"
                            }`}
                          >
                            {formatDartLabel(dartThrow)} ({dartThrow.points})
                          </button>
                        );
                      })}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <a
        href="/"
        className="min-h-12 flex items-center justify-center rounded-xl border-2 border-dart-wire text-base font-medium text-dart-cream active:border-dart-cream"
      >
        Til forsiden
      </a>

      {!isAbandoned && !isComplete && (
        <button
          type="button"
          onClick={handleAbandon}
          disabled={pending}
          className="min-h-12 text-sm text-dart-muted underline"
        >
          Afslut spil
        </button>
      )}
    </div>
  );
}
