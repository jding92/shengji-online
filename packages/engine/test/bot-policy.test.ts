import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  applyEvent,
  BOT_DIFFICULTIES,
  createGameState,
  deriveBotObservation,
  fourPlayerTwoDeckFixedTeamRuleset,
  getNextDealEvents,
  replayEvents,
  simulateBotMatch,
  validateCommand,
  type BotDifficulty,
  type GameState,
} from "../src/index.js";

const at = "2026-07-03T12:00:00.000Z";

function dealtBotState(): GameState {
  let state = createGameState({
    roomId: "BOT-HYGIENE",
    ruleset: fourPlayerTwoDeckFixedTeamRuleset,
    createdAt: at,
  });
  for (let seat = 0; seat < 4; seat += 1) {
    const playerId = `bot-${seat}`;
    state = applyEvent(state, {
      type: "PLAYER_JOINED",
      playerId,
      name: `Bot ${seat}`,
      bot: { difficulty: "advanced" },
      at,
    });
    state = replayEvents(
      state,
      validateCommand(state, playerId, { type: "SIT", seat }, { now: at }),
    );
  }
  for (let seat = 0; seat < 4; seat += 1) {
    state = replayEvents(
      state,
      validateCommand(
        state,
        `bot-${seat}`,
        { type: "READY" },
        {
          now: at,
          roundSeed: "observation-hygiene",
        },
      ),
    );
  }
  while (state.phase === "dealing") {
    state = replayEvents(state, getNextDealEvents(state, at));
  }
  return state;
}

describe("bot policy", () => {
  it("completes seeded rounds through validated commands at every difficulty", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.constantFrom(...BOT_DIFFICULTIES),
        (seed, difficulty) => {
          const result = simulateBotMatch(seed, {
            difficulties: [difficulty, difficulty, difficulty, difficulty] as [
              BotDifficulty,
              BotDifficulty,
              BotDifficulty,
              BotDifficulty,
            ],
            maxRounds: 1,
          });
          expect(result.outcomes).toHaveLength(1);
          expect(result.state.phase).toBe("round-scoring");
        },
      ),
      { numRuns: 8 },
    );
  }, 30_000);

  it("never includes hidden card identities or state-only deck fields", () => {
    const state = dealtBotState();
    const observation = deriveBotObservation(state, "bot-0");
    const serialized = JSON.stringify(observation);
    const ownIds = new Set(state.round!.hands[0]);

    for (const seat of [1, 2, 3]) {
      for (const cardId of state.round!.hands[seat]!) {
        expect(ownIds.has(cardId)).toBe(false);
        expect(serialized).not.toContain(cardId);
      }
    }
    for (const cardId of state.round!.bottom) {
      expect(serialized).not.toContain(cardId);
    }
    expect(serialized).not.toContain(state.round!.deckSeed);
    expect(observation).not.toHaveProperty("round.cards");
    expect(observation).not.toHaveProperty("round.undealt");
  });
});
