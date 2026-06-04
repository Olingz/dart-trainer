import type { GamePlayerState } from "@/lib/multiplayer";
import { sortPlayers } from "@/lib/multiplayer";

export function PlayerScoreboard({
  players,
  activePlayerId,
  legsToWin,
  setsToWin,
  showMatchCounters,
}: {
  players: GamePlayerState[];
  activePlayerId: string | null;
  legsToWin: number;
  setsToWin: number;
  showMatchCounters: boolean;
}) {
  const sorted = sortPlayers(players);
  const multi = sorted.length > 1;

  if (!multi) {
    return null;
  }

  return (
    <ul className="flex flex-col gap-2">
      {sorted.map((player) => {
        const isActive = player.id === activePlayerId;
        return (
          <li
            key={player.id}
            className={`rounded-xl border-2 px-3 py-2 ${
              isActive
                ? "border-dart-red bg-dart-red/15"
                : "border-dart-wire/40 bg-dart-black/40"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={`text-sm font-medium ${
                  isActive ? "text-dart-cream" : "text-dart-muted"
                }`}
              >
                {player.display_name}
                {player.is_self && (
                  <span className="ml-1 text-xs text-dart-muted">(dig)</span>
                )}
                {player.is_bot && (
                  <span className="ml-1 text-xs text-dart-muted">(bot)</span>
                )}
                {isActive && (
                  <span className="ml-2 text-xs font-bold uppercase text-dart-red">
                    Tur
                  </span>
                )}
              </span>
              <span className="font-display text-2xl tabular-nums text-dart-cream">
                {player.current_score}
              </span>
            </div>
            {showMatchCounters &&
              (legsToWin > 1 ||
                setsToWin > 1 ||
                player.sets_won > 0 ||
                player.legs_won > 0) && (
                <p className="mt-1 text-xs tabular-nums text-dart-muted">
                  Set {player.sets_won}/{setsToWin} · Leg {player.legs_won}/
                  {legsToWin}
                </p>
              )}
          </li>
        );
      })}
    </ul>
  );
}
