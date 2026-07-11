import { describe, expect, it } from "vitest";
import {
  eightPlayerFourDeckFixedTeamRuleset,
  simulateBotMatch,
  simulateRound,
  type BotDifficulty,
} from "../src/index.js";

describe("full-round simulation", () => {
  it("completes all 25 tricks through authoritative commands", () => {
    const simulation = simulateRound("complete-round-fixture");
    expect(["round-scoring", "game-over"]).toContain(simulation.state.phase);
    expect(simulation.state.round?.completedTricks).toHaveLength(25);
    expect(
      Object.values(simulation.state.round!.hands).every((hand) => hand.length === 0),
    ).toBe(true);
    expect(simulation.state.round?.outcome).toBeDefined();
    const played = simulation.state.round!.completedTricks.flatMap((trick) =>
      trick.plays.flatMap((play) => play.cards.map(({ id }) => id)),
    );
    const conserved = [...played, ...simulation.state.round!.buriedBottom!];
    expect(conserved).toHaveLength(108);
    expect(new Set(conserved)).toHaveLength(108);
  });

  it("replays to the same result for the same seed", () => {
    const first = simulateRound("deterministic-round");
    const second = simulateRound("deterministic-round");
    expect(first.state).toEqual(second.state);
    expect(first.events).toEqual(second.events);
  });
});

// Section C3 of the game-modes design flags 8p/4d as the scale to measure,
// not guess, at: 216 cards, ~208 CARD_DEALT events, ~27 tricks x 8 plays, with
// applyEvent structured-cloning the whole GameState per event. This asserts a
// full bot match (played to an actual game-over, not a truncated slice) stays
// comfortably under a generous CI-safe budget.
//
// Measured locally: a full deterministic 8p/4d match runs ~58 rounds and
// takes ~16-17s. The budget below is set well above that observed cost (with
// headroom for slower CI hardware) rather than the smaller number a 4p/2d
// match would suggest — the point of this test is to catch a real regression
// (e.g. an accidental O(n^2)), not to assert a specific machine's speed.
describe("performance benchmark: 8p/4d bot match", () => {
  it("completes a full 8-player/4-deck bot match within a generous time budget", () => {
    const difficulties: BotDifficulty[] = Array.from(
      { length: 8 },
      () => "intermediate",
    );
    const start = performance.now();
    const result = simulateBotMatch("perf-8p-4d", {
      ruleset: eightPlayerFourDeckFixedTeamRuleset,
      difficulties,
    });
    const durationMs = performance.now() - start;
    console.log(
      `8p/4d bot match: ${result.outcomes.length} rounds in ${durationMs.toFixed(0)}ms`,
    );

    expect(result.state.phase).toBe("game-over");
    expect(result.outcomes.length).toBeGreaterThan(0);
    expect(result.winnerTeamIds).toHaveLength(result.outcomes.length);
    expect(durationMs).toBeLessThan(60_000);
  }, 90_000);
});
