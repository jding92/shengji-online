import { describe, expect, it } from "vitest";
import { simulateRound } from "../src/index.js";

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
