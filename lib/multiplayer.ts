import { advanceAfterLegWin } from "@/lib/game-rules";

export type GamePlayerState = {
  id: string;
  display_name: string;
  player_order: number;
  is_self: boolean;
  current_score: number;
  sets_won: number;
  legs_won: number;
};

export const MAX_OPPONENTS_PER_GAME = 5;

export function normalizeOpponentName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function validateOpponentName(name: string): string | null {
  const normalized = normalizeOpponentName(name);
  if (normalized.length < 1) return "Navn skal udfyldes";
  if (normalized.length > 40) return "Navn må højst være 40 tegn";
  return null;
}

export function sortPlayers(players: GamePlayerState[]): GamePlayerState[] {
  return [...players].sort((a, b) => a.player_order - b.player_order);
}

export function nextPlayer(
  players: GamePlayerState[],
  currentPlayerId: string,
): GamePlayerState {
  const sorted = sortPlayers(players);
  const index = sorted.findIndex((p) => p.id === currentPlayerId);
  return sorted[(index + 1 + sorted.length) % sorted.length];
}

export function applyLegWinToPlayers(
  players: GamePlayerState[],
  winnerId: string,
  startScore: number,
  format: { legsToWin: number; setsToWin: number },
  global: { currentSet: number; currentLeg: number },
): {
  players: GamePlayerState[];
  matchComplete: boolean;
  winnerId: string | null;
  currentSet: number;
  currentLeg: number;
} {
  const winner = players.find((p) => p.id === winnerId);
  if (!winner) {
    return {
      players,
      matchComplete: false,
      winnerId: null,
      currentSet: global.currentSet,
      currentLeg: global.currentLeg,
    };
  }

  const advanced = advanceAfterLegWin(
    {
      setsWon: winner.sets_won,
      legsWon: winner.legs_won,
      currentSet: global.currentSet,
      currentLeg: global.currentLeg,
    },
    format,
  );

  const updatedPlayers = players.map((player) => {
    if (player.id !== winnerId) {
      return {
        ...player,
        current_score: advanced.matchComplete ? player.current_score : startScore,
      };
    }
    return {
      ...player,
      sets_won: advanced.counters.setsWon,
      legs_won: advanced.counters.legsWon,
      current_score: advanced.matchComplete ? 0 : startScore,
    };
  });

  return {
    players: updatedPlayers,
    matchComplete: advanced.matchComplete,
    winnerId: advanced.matchComplete ? winnerId : null,
    currentSet: advanced.counters.currentSet,
    currentLeg: advanced.counters.currentLeg,
  };
}

export function selfPlayer(
  players: GamePlayerState[],
): GamePlayerState | undefined {
  return players.find((p) => p.is_self);
}
