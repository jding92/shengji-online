import type { ClientCommand } from "../state/model.js";
import { decideBidAction } from "./bidding.js";
import { decideBuryAction } from "./bury.js";
import { decideFollowAction } from "./follow.js";
import { decideFriendCallAction } from "./friends.js";
import { decideLeadAction } from "./lead.js";
import type { BotObservation } from "./observation.js";
import { createBotRng } from "./rng.js";
import type { BotConfig } from "./types.js";

export function decideBotAction(
  observation: BotObservation,
  config: BotConfig,
  rngSeed: string,
): ClientCommand | null {
  const rng = createBotRng(rngSeed);
  if (observation.phase === "lobby") {
    if (observation.ownSeat === null) {
      const seat = observation.seats.find(({ playerId }) => playerId === null);
      return seat === undefined ? null : { type: "SIT", seat: seat.seat };
    }
    const ownSeat = observation.seats.find(({ seat }) => seat === observation.ownSeat);
    return ownSeat?.ready === true ? null : { type: "READY" };
  }
  if (observation.phase === "dealing" || observation.phase === "post-deal-bidding") {
    return decideBidAction(observation, config, rng);
  }
  if (observation.phase === "bottom-exchange") {
    return decideBuryAction(observation, config, rng);
  }
  if (observation.phase === "friend-calling") {
    return decideFriendCallAction(observation);
  }
  if (observation.phase === "playing") {
    return observation.round?.currentTrick === undefined
      ? decideLeadAction(observation, config, rng)
      : decideFollowAction(observation, config, rng);
  }
  if (
    observation.phase === "round-scoring" &&
    observation.ownSeat === observation.leaderSeat
  ) {
    return { type: "START_NEXT_ROUND" };
  }
  return null;
}
