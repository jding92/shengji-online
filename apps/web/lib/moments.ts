import type { CardInstance, PrivateGameView } from "@shengji/protocol";

type RoundView = NonNullable<PrivateGameView["publicRound"]>;

export type GameMoment =
  | { id: string; type: "TRUMP_DECLARED"; seat?: number }
  | { id: string; type: "CARD_PLAYED"; seat: number; cards: CardInstance[] }
  | { id: string; type: "TRICK_WON"; winnerSeat: number; points: number }
  | { id: string; type: "POINTS_CAPTURED"; delta: number; total: number }
  | {
      id: string;
      type: "KITTY_REVEALED";
      cards: CardInstance[];
      multiplier: number;
      pointsAwarded: number;
    }
  | {
      id: string;
      type: "ROUND_ENDED";
      winner: "defenders" | "attackers";
      levelDelta: number;
      attackerPoints: number;
    }
  | { id: string; type: "GAME_OVER"; winner: "defenders" | "attackers" };

function completedCount(round: RoundView | undefined): number {
  return round?.completedTricksSummary.length ?? 0;
}

function playCount(round: RoundView | undefined): number {
  return round?.currentTrick?.plays.length ?? 0;
}

function stickyMoments(
  prev: PrivateGameView,
  next: PrivateGameView,
  nextRound: RoundView | undefined,
): GameMoment[] {
  const moments: GameMoment[] = [];
  if (prev.publicRound?.bottomReveal === undefined && nextRound?.bottomReveal) {
    moments.push({
      id: `kitty-revealed:${nextRound.roundNumber}`,
      type: "KITTY_REVEALED",
      cards: nextRound.bottomReveal.cards,
      multiplier: nextRound.bottomReveal.multiplier,
      pointsAwarded: nextRound.bottomReveal.pointsAwarded,
    });
  }
  if (prev.publicRound?.outcome === undefined && nextRound?.outcome) {
    moments.push({
      id: `round-ended:${nextRound.roundNumber}`,
      type: "ROUND_ENDED",
      winner: nextRound.outcome.winner,
      levelDelta: nextRound.outcome.levelDelta,
      attackerPoints: nextRound.outcome.attackerPoints,
    });
  }
  if (prev.phase !== "game-over" && next.phase === "game-over") {
    const winner = nextRound?.outcome?.winner ?? prev.publicRound?.outcome?.winner;
    if (winner !== undefined) {
      moments.push({
        id: `game-over:${nextRound?.roundNumber ?? prev.publicRound?.roundNumber ?? next.revision}`,
        type: "GAME_OVER",
        winner,
      });
    }
  }
  return moments;
}

export function deriveMoments(
  prev: PrivateGameView | null,
  next: PrivateGameView,
): GameMoment[] {
  if (prev === null) return [];

  const prevRound = prev.publicRound;
  const nextRound = next.publicRound;
  const prevCompletedCount = completedCount(prevRound);
  const nextCompletedCount = completedCount(nextRound);
  const completedGrowth = nextCompletedCount - prevCompletedCount;
  const prevPlayCount = playCount(prevRound);
  const nextPlayCount = playCount(nextRound);
  const playGrowth = nextPlayCount - prevPlayCount;
  const roundChanged =
    prevRound !== undefined &&
    nextRound !== undefined &&
    prevRound.roundNumber !== nextRound.roundNumber;
  const resyncGap =
    completedGrowth > 1 ||
    playGrowth > 2 ||
    (roundChanged && (completedGrowth > 0 || playGrowth > 0));

  if (resyncGap) return stickyMoments(prev, next, nextRound);

  const moments: GameMoment[] = [];
  if (nextRound === undefined) {
    moments.push(...stickyMoments(prev, next, nextRound));
    return moments;
  }

  const comparisonsReset = roundChanged || prevRound === undefined;

  if (
    !comparisonsReset &&
    prevRound.trumpSpec === undefined &&
    nextRound.trumpSpec !== undefined
  ) {
    moments.push({
      id: `trump-declared:${nextRound.roundNumber}`,
      type: "TRUMP_DECLARED",
      ...(nextRound.currentBid?.seat === undefined
        ? {}
        : { seat: nextRound.currentBid.seat }),
    });
  }

  if (!comparisonsReset && nextRound.currentTrick !== undefined) {
    const newPlays =
      prevRound.currentTrick === undefined || playGrowth < 0
        ? nextRound.currentTrick.plays
        : nextRound.currentTrick.plays.slice(prevPlayCount);
    const playStartIndex =
      prevRound.currentTrick === undefined || playGrowth < 0 ? 0 : prevPlayCount;
    newPlays.forEach((play, offset) => {
      moments.push({
        id: `play:${nextRound.roundNumber}:${nextCompletedCount}:${playStartIndex + offset}`,
        type: "CARD_PLAYED",
        seat: play.seat,
        cards: play.cards,
      });
    });
  }

  if (!comparisonsReset && completedGrowth === 1 && nextRound.lastCompletedTrick) {
    moments.push({
      id: `trick-won:${nextRound.roundNumber}:${nextCompletedCount}`,
      type: "TRICK_WON",
      winnerSeat: nextRound.lastCompletedTrick.winnerSeat,
      points: nextRound.lastCompletedTrick.points,
    });
  }

  if (!comparisonsReset && nextRound.attackerPoints > prevRound.attackerPoints) {
    moments.push({
      id: `points-captured:${nextRound.roundNumber}:${nextRound.attackerPoints}`,
      type: "POINTS_CAPTURED",
      delta: nextRound.attackerPoints - prevRound.attackerPoints,
      total: nextRound.attackerPoints,
    });
  }

  moments.push(...stickyMoments(prev, next, nextRound));
  return moments;
}
