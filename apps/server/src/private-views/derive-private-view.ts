import {
  DEFAULT_PRESET_ID,
  knownTeamIdForSeat,
  seatRole,
  type GameState,
} from "@shengji/engine";
import type {
  LegalAction,
  PrivateGameView,
  PublicFriendCall,
  SeatView,
} from "@shengji/protocol";

function legalActions(state: GameState, playerId: string): LegalAction[] {
  const player = state.players[playerId];
  if (player === undefined) return [];
  const seat = player.seat;
  if (state.phase === "lobby") {
    const actions: LegalAction[] = seat === null ? ["sit"] : ["sit", "ready"];
    if (state.hostPlayerId === playerId) actions.push("update-options");
    return actions;
  }
  if (seat === null) return [];
  if (state.phase === "dealing") return ["bid"];
  if (state.phase === "post-deal-bidding") {
    return state.round?.passedBidSeats.includes(seat) === true
      ? []
      : ["bid", "pass-bid"];
  }
  if (state.phase === "bottom-exchange" && state.leaderSeat === seat) {
    return ["bury-bottom"];
  }
  if (state.phase === "friend-calling") {
    return state.round?.declarerSeat === seat ? ["call-friends"] : [];
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
  // The only membership source views may use: fixed mode always resolves, and
  // finding-friends resolves exclusively from the declarer plus reveal events
  // — an unrevealed friend's view carries no team, even to that player's
  // teammates-to-be. finalTeamIdForSeat stays engine-internal by design.
  const yourTeamId =
    player.seat === null ? undefined : knownTeamIdForSeat(state, player.seat);

  const seats: SeatView[] = Array.from(
    { length: state.rulesetSnapshot.players.count },
    (_, seat) => {
      const occupantId = state.seats[seat] ?? null;
      const occupant = occupantId === null ? undefined : state.players[occupantId];
      const teamId = occupantId === null ? undefined : knownTeamIdForSeat(state, seat);
      return {
        seat,
        playerId: occupantId,
        name: occupant?.name ?? null,
        connected: occupant?.connected ?? false,
        isBot: occupant?.bot !== undefined,
        ...(occupant?.bot === undefined
          ? {}
          : { botDifficulty: occupant.bot.difficulty }),
        ready: occupant?.ready ?? false,
        rank: occupantId === null ? null : (state.ranks[occupantId] ?? null),
        cardCount: round?.hands[seat]?.length ?? 0,
        role: seatRole(state, seat),
        ...(teamId === undefined ? {} : { teamId }),
      };
    },
  );
  const previousRound = state.roundHistory?.at(-1);
  const isFindingFriends = state.rulesetSnapshot.teams.mode === "finding-friends";
  // Type-level narrowing for the teams union; empty in finding-friends, where
  // per-team tallies across rounds are meaningless (teams are round-scoped).
  const fixedTeams =
    state.rulesetSnapshot.teams.mode === "fixed"
      ? state.rulesetSnapshot.teams.teams
      : [];
  const roundsWonByTeam = Object.fromEntries(
    fixedTeams.map((_, index) => {
      const teamId = `team-${index}`;
      return [
        teamId,
        (state.roundHistory ?? []).filter(
          ({ winningTeamId }) => winningTeamId === teamId,
        ).length,
      ];
    }),
  );
  // Finding-friends per-seat tallies come from the durable round history:
  // the recorded defender seats plus each outcome's winner — never from
  // hidden membership.
  const roundsWonBySeat = isFindingFriends
    ? Object.fromEntries(
        Array.from({ length: state.rulesetSnapshot.players.count }, (_, seat) => [
          seat,
          (state.roundHistory ?? []).filter(({ outcome, defenderSeats }) => {
            const defended = defenderSeats?.includes(seat) === true;
            return outcome.winner === "defenders" ? defended : !defended;
          }).length,
        ]),
      )
    : undefined;
  const publicFriendCalls: PublicFriendCall[] | undefined = round?.friendCalls?.map(
    ({ face, copyIndex, revealed }) => ({
      face,
      copyIndex,
      // The reveal's `at` timestamp stays server-side, matching currentBid's
      // omitted placedAt: public view fields carry no event-time metadata.
      ...(revealed === undefined
        ? {}
        : { revealed: { seat: revealed.seat, trickNumber: revealed.trickNumber } }),
    }),
  );
  const lastCompletedTrick = round?.completedTricks.at(-1);

  return {
    roomId: state.roomId,
    revision: state.revision,
    hostPlayerId: state.hostPlayerId ?? null,
    joinedPlayerCount: Object.keys(state.players).length,
    ruleset: {
      id: state.rulesetSnapshot.id,
      name: state.rulesetSnapshot.name,
      players: state.rulesetSnapshot.players.count,
      decks: state.rulesetSnapshot.decks.count,
      bottomSize: state.rulesetSnapshot.bottom.size,
      presetId: state.presetId ?? DEFAULT_PRESET_ID,
      teamsMode: state.rulesetSnapshot.teams.mode,
      options: state.pendingOptions ?? {},
    },
    phase: state.phase,
    you: {
      playerId,
      seat: player.seat,
      hand: yourHand,
      ...(yourTeamId === undefined ? {} : { teamId: yourTeamId }),
      // The leader buried these from their own hand, so it's their
      // information; everyone else keeps seeing only buriedBottomCount.
      ...(player.seat !== null &&
      player.seat === state.leaderSeat &&
      round?.buriedBottom !== undefined
        ? { buried: round.buriedBottom.map((id) => round.cards[id]!) }
        : {}),
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
            ...(round.declarerSeat === undefined
              ? {}
              : { declarerSeat: round.declarerSeat }),
            ...(publicFriendCalls === undefined
              ? {}
              : { friendCalls: publicFriendCalls }),
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
            ...(lastCompletedTrick === undefined
              ? {}
              : {
                  lastCompletedTrick: {
                    leadSeat: lastCompletedTrick.leadSeat,
                    winnerSeat: lastCompletedTrick.winnerSeat,
                    points: lastCompletedTrick.points,
                    plays: lastCompletedTrick.plays.map((play) => ({
                      seat: play.seat,
                      cards: play.cards,
                    })),
                  },
                }),
            completedTricksSummary: round.completedTricks.map(
              ({ leadSeat, winnerSeat, points }) => ({ leadSeat, winnerSeat, points }),
            ),
            roundStats: {
              roundsWonByTeam,
              ...(roundsWonBySeat === undefined ? {} : { roundsWonBySeat }),
              ...(previousRound === undefined
                ? {}
                : {
                    previousRound: {
                      roundNumber: previousRound.roundNumber,
                      winningTeamId: previousRound.winningTeamId,
                      winner: previousRound.outcome.winner,
                      attackerPoints: previousRound.outcome.attackerPoints,
                      levelDelta: previousRound.outcome.levelDelta,
                      defenderSeats: previousRound.defenderSeats ?? [],
                    },
                  }),
            },
            ...(round.biddingDeadline === undefined
              ? {}
              : { biddingDeadline: round.biddingDeadline }),
            bottomCount: round.bottom.length,
            buriedBottomCount: round.buriedBottom?.length ?? 0,
            ...(round.lastThrow === undefined ? {} : { lastThrow: round.lastThrow }),
            ...(round.outcome === undefined ? {} : { outcome: round.outcome }),
            ...(round.bottomReveal === undefined
              ? {}
              : {
                  bottomReveal: {
                    cards: round.bottomReveal.cards.map((id) => round.cards[id]!),
                    multiplier: round.bottomReveal.multiplier,
                    pointsAwarded: round.bottomReveal.pointsAwarded,
                  },
                }),
          },
        }),
    legalActions: legalActions(state, playerId),
  };
}
