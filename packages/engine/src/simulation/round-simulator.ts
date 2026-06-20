import { getEffectiveSuit } from "../trump/trump.js";
import type { GameEvent, GameState } from "../state/model.js";
import {
  getFinalizeBiddingEvents,
  getNextDealEvents,
  validateCommand,
} from "../state/commands.js";
import { applyEvent, createGameState, replayEvents } from "../state/reducer.js";
import { fourPlayerTwoDeckFixedTeamRuleset } from "../rulesets/four-player-two-deck.js";

export type RoundSimulation = {
  state: GameState;
  events: GameEvent[];
};

/**
 * Deterministic smoke harness that completes a round using legal single-card
 * plays. It exercises the complete lifecycle without bypassing command checks.
 */
export function simulateRound(seed: string): RoundSimulation {
  const at = "2026-01-01T00:00:00.000Z";
  let state = createGameState({
    roomId: "SIMULATED",
    ruleset: fourPlayerTwoDeckFixedTeamRuleset,
    createdAt: at,
  });
  const events: GameEvent[] = [];
  const commit = (nextEvents: readonly GameEvent[]) => {
    events.push(...nextEvents);
    state = replayEvents(state, nextEvents);
  };

  for (let seat = 0; seat < 4; seat += 1) {
    const playerId = `player-${seat}`;
    const joined: GameEvent = {
      type: "PLAYER_JOINED",
      playerId,
      name: `Player ${seat + 1}`,
      at,
    };
    events.push(joined);
    state = applyEvent(state, joined);
    commit(validateCommand(state, playerId, { type: "SIT", seat }, { now: at }));
  }
  for (let seat = 0; seat < 4; seat += 1) {
    commit(
      validateCommand(
        state,
        `player-${seat}`,
        { type: "READY" },
        { now: at, roundSeed: seed },
      ),
    );
  }
  while (state.phase === "dealing") commit(getNextDealEvents(state, at));

  const bidderSeat = Object.keys(state.round!.hands)
    .map(Number)
    .find((seat) =>
      state.round!.hands[seat]!.some((id) => {
        const face = state.round!.cards[id]!.face;
        return face.kind === "standard" && face.rank === state.round!.trumpRank;
      }),
    );
  if (bidderSeat === undefined) throw new Error("Generated deal has no level-card bid");
  const bidCard = state.round!.hands[bidderSeat]!.find((id) => {
    const face = state.round!.cards[id]!.face;
    return face.kind === "standard" && face.rank === state.round!.trumpRank;
  })!;
  commit(
    validateCommand(
      state,
      `player-${bidderSeat}`,
      { type: "BID", cards: [bidCard] },
      { now: at },
    ),
  );
  commit(getFinalizeBiddingEvents(state, at));
  const leaderSeat = state.leaderSeat!;
  commit(
    validateCommand(
      state,
      `player-${leaderSeat}`,
      { type: "BURY_BOTTOM", cards: state.round!.hands[leaderSeat]!.slice(0, 8) },
      { now: at },
    ),
  );

  while (state.phase === "playing") {
    const round = state.round!;
    const seat = round.currentTurnSeat!;
    const hand = round.hands[seat]!;
    const ledSuit = round.currentTrick?.ledFormat.effectiveSuit;
    const selected =
      ledSuit === undefined
        ? hand[0]
        : (hand.find(
            (id) => getEffectiveSuit(round.cards[id]!, round.trumpSpec!) === ledSuit,
          ) ?? hand[0]);
    if (selected === undefined) throw new Error(`Seat ${seat} has no playable card`);
    commit(
      validateCommand(
        state,
        `player-${seat}`,
        { type: "PLAY_CARDS", cards: [selected], intent: "normal" },
        { now: at },
      ),
    );
  }

  return { state, events };
}
