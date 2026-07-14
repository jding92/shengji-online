import type { BotDifficulty } from "@shengji/protocol";
import { roomSessionToken } from "./session";

async function botRequest(
  roomId: string,
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  payload: Record<string, unknown> = {},
): Promise<void> {
  const playerToken = roomSessionToken(roomId);
  if (playerToken === null) throw new Error("Your room session is unavailable");
  const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ playerToken, ...payload }),
  });
  if (response.ok) return;
  const body = (await response.json()) as { error?: string };
  throw new Error(body.error ?? "The bot request failed");
}

export function addBot(
  roomId: string,
  seat: number,
  difficulty: BotDifficulty,
): Promise<void> {
  return botRequest(roomId, "/bots", "POST", { seat, difficulty });
}

export function removeBot(roomId: string, botId: string): Promise<void> {
  return botRequest(roomId, `/bots/${encodeURIComponent(botId)}`, "DELETE");
}

export function changeBotDifficulty(
  roomId: string,
  botId: string,
  difficulty: BotDifficulty,
): Promise<void> {
  return botRequest(roomId, `/bots/${encodeURIComponent(botId)}`, "PATCH", {
    difficulty,
  });
}

export function replaceWithBot(
  roomId: string,
  playerId: string,
  difficulty: BotDifficulty,
): Promise<void> {
  return botRequest(
    roomId,
    `/players/${encodeURIComponent(playerId)}/bot-takeover`,
    "POST",
    { difficulty },
  );
}
