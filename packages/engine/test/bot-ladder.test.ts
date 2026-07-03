import { describe, expect, it } from "vitest";
import { simulateBotMatch, type BotDifficulty } from "../src/index.js";

const environment = (
  globalThis as {
    process?: { env?: Record<string, string | undefined> };
  }
).process?.env;
const ladderRuns = Number.parseInt(environment?.["BOT_LADDER_RUNS"] ?? "10", 10);

function winRate(stronger: BotDifficulty, weaker: BotDifficulty, runs: number): number {
  let wins = 0;
  for (let index = 0; index < runs; index += 1) {
    const result = simulateBotMatch(`ladder:${stronger}:${weaker}:${index}`, {
      difficulties: [stronger, weaker, stronger, weaker],
      maxRounds: 1,
    });
    if (result.winnerTeamIds[0] === "team-0") wins += 1;
  }
  return wins / runs;
}

describe("bot difficulty ladder", () => {
  it("gives stronger configurations an aggregate edge", () => {
    const adjacentPairs = [
      ["intermediate", "beginner"],
      ["advanced", "intermediate"],
      ["expert", "advanced"],
    ] as const;
    const adjacentRates = adjacentPairs.map(([stronger, weaker]) =>
      winRate(stronger, weaker, ladderRuns),
    );
    const expertRate = winRate("expert", "beginner", ladderRuns);

    if (ladderRuns >= 100) {
      for (const [index, rate] of adjacentRates.entries()) {
        expect
          .soft(rate, `${adjacentPairs[index]!.join(" vs ")} win rate`)
          .toBeGreaterThan(0.55);
      }
      expect.soft(expertRate, "expert vs beginner win rate").toBeGreaterThan(0.75);
    } else {
      expect(
        adjacentRates.reduce((total, rate) => total + rate, 0) / adjacentRates.length,
      ).toBeGreaterThan(0.5);
      expect(expertRate).toBeGreaterThan(0.5);
    }
  }, 120_000);
});
