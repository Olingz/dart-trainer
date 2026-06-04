"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { abandonGame, submitRound, updateDartThrow } from "@/app/game/actions";
import { DartInputPad } from "@/components/dart-input-pad";
import { GameStatsBar } from "@/components/game-stats-bar";
import { PlayerScoreboard } from "@/components/player-scoreboard";
import { TripleTwentyShower } from "@/components/triple-twenty-shower";
import type { GamePlayerState } from "@/lib/multiplayer";
import {
  calculateDartPoints,
  dartThrowRowToInput,
  formatDartLabel,
  isTripleTwenty,
  sumDartInputs,
  type DartInput,
  type DartThrowRow,
} from "@/lib/dart-score";
import { DARTS_PER_ROUND, evaluateVisit } from "@/lib/game-rules";
import {
  checkoutModeLabel,
  formatMatchRules,
  type CheckoutMode,
} from "@/lib/match-config";

type Round = {
  id: string;
  round_number: number;
  points_scored: number;
  score_after: number;
  is_bust: boolean;
  game_player_id: string | null;
  player_name: string | null;
  dart_throws: DartThrowRow[];
};

type Game = {
  id: string;
  start_score: number;
  current_score: number;
  status: string;
  checkout_mode: CheckoutMode;
  legs_to_win: number;
  sets_to_win: number;
  sets_won: number;
  legs_won: number;
  current_set: number;
  current_leg: number;
  active_player_id: string | null;
  winner_player_id: string | null;
};

type GamePlayProps = {
  game: Game;
  players: GamePlayerState[];
  rounds: Round[];
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

export function GamePlay({ game, players, rounds }: GamePlayProps) {
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
  const isMultiplayer = players.length > 1;
  const activePlayer =
    players.find((p) => p.id === game.active_player_id) ?? players[0];
  const activeScore = activePlayer?.current_score ?? game.current_score;
  const winner = players.find((p) => p.id === game.winner_player_id);
  const showMatchProgress =
    game.sets_to_win > 1 ||
    game.legs_to_win > 1 ||
    game.sets_won > 0 ||
    isMultiplayer;
  const isAbandoned = game.status === "abandoned";
  const canPlay = !isAbandoned && (!isComplete || editTarget !== null);
  const dartIndex = visitDarts.length + 1;
  const visitTotal = sumDartInputs(visitDarts);
  const visitRemaining = activeScore - visitTotal;
  const activePlayerRounds = isMultiplayer
    ? rounds.filter((r) => r.game_player_id === activePlayer?.id)
    : rounds;

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
      const outcome = evaluateVisit(
        activeScore,
        next,
        game.checkout_mode,
      );
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

    const outcome = evaluateVisit(activeScore, next, game.checkout_mode);
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

      <div className="dart-panel rounded-xl px-4 py-3 text-sm">
        <p className="font-medium text-dart-cream">{formatMatchRules(game)}</p>
        {!isMultiplayer && showMatchProgress && (
          <p className="mt-1 tabular-nums text-dart-muted">
            Sets {game.sets_won}/{game.sets_to_win}
            {" · "}
            Legs {game.legs_won}/{game.legs_to_win}
            {" · "}
            Set {game.current_set} · Leg {game.current_leg}
          </p>
        )}
        <p className="mt-1 text-xs text-dart-muted">
          {checkoutModeLabel(game.checkout_mode)}
          {game.checkout_mode === "double" && " · skal slutte på double"}
        </p>
      </div>

      {isMultiplayer && (
        <PlayerScoreboard
          players={players}
          activePlayerId={game.active_player_id}
          legsToWin={game.legs_to_win}
          setsToWin={game.sets_to_win}
          showMatchCounters={
            game.legs_to_win > 1 ||
            game.sets_to_win > 1 ||
            players.some((p) => p.sets_won > 0 || p.legs_won > 0)
          }
        />
      )}

      {isComplete && !editTarget && (
        <div className="rounded-2xl border-2 border-dart-cream bg-dart-green px-6 py-8 text-center text-dart-cream">
          <p className="font-display text-xl tracking-wide">Kamp vundet</p>
          {winner && (
            <p className="mt-1 text-lg font-medium text-dart-cream/95">
              {winner.display_name}
            </p>
          )}
          {showMatchProgress && !isMultiplayer && (
            <p className="mt-1 text-sm text-dart-cream/90">
              {game.sets_won} set · {game.legs_won} legs i sidste set
            </p>
          )}
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
          {isMultiplayer && activePlayer && !editTarget && (
            <p className="font-display text-lg tracking-wide text-dart-green">
              {activePlayer.display_name}
            </p>
          )}
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
          <GameStatsBar
            rounds={activePlayerRounds}
            currentVisitDarts={visitDarts}
          />
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
                  <span className="text-dart-muted">
                    #{round.round_number}
                    {round.player_name && (
                      <span className="ml-1 text-dart-cream/80">
                        · {round.player_name}
                      </span>
                    )}
                  </span>
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
