import { teamIdForSeat, type GameState } from "@shengji/engine";
import type { LegalAction, PrivateGameView, SeatView } from "@shengji/protocol";

function legalActions(state: GameState, playerId: string): LegalAction[] {
  const player = state.players[playerId];
  if (player === undefined) return [];
  const seat = player.seat;
  if (state.phase === "lobby") {
    return seat === null ? ["sit"] : ["sit", "ready"];
  }
  if (seat === null) return [];
  if (state.phase === "dealing") return ["bid"];
  if (state.phase === "post-deal-bidding") return ["bid", "pass-bid"];
  if (state.phase === "bottom-exchange" && state.leaderSeat === seat) {
    return ["bury-bottom"];
  }
  if (state.phase === "playing" && state.round?.currentTurnSeat === seat) {
    return state.round.currentTrick === undefined
      ? ["play-cards", "attempt-throw"]
      : ["play-cards"];
  }
  if (state.phase === "round-scoring" && state.leaderSeat === seat) {
    return ["start-next-round"];
  }
  return [];
}

export function derivePrivateView(state: GameState, playerId: string): PrivateGameView {
  const player = state.players[playerId];
  if (player === undefined) throw new RangeError(`Unknown player ${playerId}`);
  const round = state.round;
  const yourHand =
    player.seat === null || round === undefined
      ? []
      : (round.hands[player.seat] ?? []).map((id) => round.cards[id]!);
  const yourTeamId =
    player.seat === null
      ? undefined
      : teamIdForSeat(player.seat, state.rulesetSnapshot);

  const seats: SeatView[] = Array.from(
    { length: state.rulesetSnapshot.players.count },
    (_, seat) => {
      const occupantId = state.seats[seat] ?? null;
      const occupant = occupantId === null ? undefined : state.players[occupantId];
      return {
        seat,
        playerId: occupantId,
        name: occupant?.name ?? null,
        connected: occupant?.connected ?? false,
        ready: occupant?.ready ?? false,
        rank: occupantId === null ? null : (state.ranks[occupantId] ?? null),
        cardCount: round?.hands[seat]?.length ?? 0,
        ...(occupantId === null
          ? {}
          : { teamId: teamIdForSeat(seat, state.rulesetSnapshot) }),
      };
    },
  );

  return {
    roomId: state.roomId,
    revision: state.revision,
    ruleset: {
      id: state.rulesetSnapshot.id,
      name: state.rulesetSnapshot.name,
      players: state.rulesetSnapshot.players.count,
      decks: state.rulesetSnapshot.decks.count,
      bottomSize: state.rulesetSnapshot.bottom.size,
    },
    phase: state.phase,
    you: {
      playerId,
      seat: player.seat,
      hand: yourHand,
      ...(yourTeamId === undefined ? {} : { teamId: yourTeamId }),
    },
    seats,
    ...(round === undefined
      ? {}
      : {
          publicRound: {
            roundNumber: round.roundNumber,
            trumpRank: round.trumpRank,
            ...(round.trumpSpec === undefined ? {} : { trumpSpec: round.trumpSpec }),
            ...(round.currentBid === undefined
              ? {}
              : {
                  currentBid: {
                    seat: round.currentBid.seat,
                    face: round.currentBid.face,
                    count: round.currentBid.count,
                    tier: round.currentBid.tier,
                    declares: round.currentBid.declares,
                  },
                }),
            ...(state.leaderSeat === undefined ? {} : { leaderSeat: state.leaderSeat }),
            ...(round.currentTurnSeat === undefined
              ? {}
              : { currentTurnSeat: round.currentTurnSeat }),
            attackerPoints: round.attackerPoints,
            throwPenaltyAdjustment: round.throwPenaltyAdjustment,
            cardCountsBySeat: Object.fromEntries(
              Object.entries(round.hands).map(([seat, hand]) => [seat, hand.length]),
            ),
            ...(round.currentTrick === undefined
              ? {}
              : {
                  currentTrick: {
                    leadSeat: round.currentTrick.leadSeat,
                    cardCount: round.currentTrick.ledFormat.cardCount,
                    plays: round.currentTrick.plays.map((play) => ({
                      seat: play.seat,
                      cards: play.cards,
                    })),
                  },
                }),
            completedTricksSummary: round.completedTricks.map(
              ({ leadSeat, winnerSeat, points }) => ({ leadSeat, winnerSeat, points }),
            ),
            ...(round.biddingDeadline === undefined
              ? {}
              : { biddingDeadline: round.biddingDeadline }),
            bottomCount: round.bottom.length,
            buriedBottomCount: round.buriedBottom?.length ?? 0,
            ...(round.lastThrow === undefined ? {} : { lastThrow: round.lastThrow }),
            ...(round.outcome === undefined ? {} : { outcome: round.outcome }),
          },
        }),
    legalActions: legalActions(state, playerId),
  };
}
