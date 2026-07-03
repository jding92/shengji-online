export const BOT_DIFFICULTIES = [
  "beginner",
  "intermediate",
  "advanced",
  "expert",
] as const;

export type BotDifficulty = (typeof BOT_DIFFICULTIES)[number];

export type BotConfig = {
  difficulty: BotDifficulty;
  temperature: number;
  blunderRate: number;
  candidateLimit?: number;
  cardCounting: boolean;
  voidInference: boolean;
  teamCoordination: "none" | "winner" | "full";
  pointManagement: boolean;
  trumpConservation: boolean;
  throws: "never" | "safe-limited" | "safe";
  endgameAwareness: boolean;
  bidAggression: number;
  bidTiming: number;
  counterBid: "never" | "pair-only" | "strong" | "full";
  buryQuality: "basic" | "points" | "voids" | "endgame";
};
