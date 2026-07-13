import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  createGameState,
  DEFAULT_PRESET_ID,
  resolveRuleset,
  type BotDifficulty,
  type GameOptions,
  type GameState,
  type ResolveIssue,
} from "@shengji/engine";
import { Room, type RoomOptions } from "./room.js";
import type { SqliteStore } from "./persistence/sqlite-store.js";

/** Thrown when create-room options fail to resolve; surfaced as HTTP 400. */
export class RulesetResolutionError extends Error {
  constructor(readonly issues: ResolveIssue[]) {
    super(issues[0]?.message ?? "Invalid ruleset options");
    this.name = "RulesetResolutionError";
  }
}

const ROOM_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const BOT_NAMES = ["Ming", "Wei", "Lan", "Jun", "Mei", "Bo"] as const;

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function roomCode(): string {
  const bytes = randomBytes(6);
  return [...bytes].map((byte) => ROOM_ALPHABET[byte % ROOM_ALPHABET.length]).join("");
}

function positiveIntegerEnv(name: string): number | undefined {
  const value = process.env[name];
  if (value === undefined) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export type JoinResult = {
  roomId: string;
  playerId: string;
  playerToken: string;
  resumed: boolean;
};

export type CreateRoomOptions = {
  at?: string;
  practice?: boolean;
  botDifficulty?: BotDifficulty;
  presetId?: string;
  options?: GameOptions;
};

export class RoomManager {
  private readonly rooms = new Map<string, Room>();

  constructor(
    private readonly store: SqliteStore,
    private readonly roomOptions: RoomOptions = {},
  ) {
    for (const state of store.loadActiveRooms()) {
      this.rooms.set(state.roomId, new Room(state, store, roomOptions));
    }
  }

  async createRoom(input: CreateRoomOptions | string = {}): Promise<Room> {
    const options = typeof input === "string" ? { at: input } : input;
    const at = options.at ?? new Date().toISOString();
    let roomId = roomCode();
    while (this.rooms.has(roomId) || this.store.loadRoom(roomId) !== null)
      roomId = roomCode();
    const presetId = options.presetId ?? DEFAULT_PRESET_ID;
    const suppliedOptions = options.options ?? {};
    const postDealWindowSeconds = positiveIntegerEnv("BID_POST_DEAL_SECONDS");
    const responseWindowSeconds = positiveIntegerEnv("BID_RESPONSE_SECONDS");
    const mergedOptions: GameOptions = {
      ...suppliedOptions,
      ...(postDealWindowSeconds === undefined && responseWindowSeconds === undefined
        ? {}
        : {
            timers: {
              ...suppliedOptions.timers,
              ...(postDealWindowSeconds === undefined ? {} : { postDealWindowSeconds }),
              ...(responseWindowSeconds === undefined ? {} : { responseWindowSeconds }),
            },
          }),
    };
    const resolved = resolveRuleset(presetId, mergedOptions);
    if (!resolved.ok) throw new RulesetResolutionError(resolved.issues);
    const ruleset = resolved.ruleset;
    const state = createGameState({
      roomId,
      ruleset,
      createdAt: at,
      presetId,
      pendingOptions: mergedOptions,
    });
    this.store.createRoom(state);
    const room = new Room(state, this.store, this.roomOptions);
    this.rooms.set(roomId, room);
    if (options.practice === true) {
      const difficulty = options.botDifficulty ?? "intermediate";
      for (let seat = 1; seat < ruleset.players.count; seat += 1) {
        await this.addBot(roomId, seat, difficulty, at);
      }
    }
    return room;
  }

  getRoom(roomId: string): Room | null {
    return this.rooms.get(roomId.toUpperCase()) ?? null;
  }

  async joinRoom(input: {
    roomId: string;
    name: string;
    resumeToken?: string;
    at?: string;
  }): Promise<JoinResult> {
    const roomId = input.roomId.toUpperCase();
    const room = this.getRoom(roomId);
    if (room === null) throw new RangeError("Room not found");
    const at = input.at ?? new Date().toISOString();

    if (input.resumeToken !== undefined) {
      const session = this.store.findSession(roomId, tokenHash(input.resumeToken));
      if (session === null || room.state.players[session.playerId] === undefined) {
        throw new RangeError("Resume token is invalid");
      }
      this.store.touchSession(
        roomId,
        session.playerId,
        room.state.players[session.playerId]?.seat ?? null,
        at,
      );
      return {
        roomId,
        playerId: session.playerId,
        playerToken: input.resumeToken,
        resumed: true,
      };
    }

    const name = input.name.trim();
    if (name.length < 1 || name.length > 32) {
      throw new RangeError("Name must be between 1 and 32 characters");
    }
    if (room.state.phase !== "lobby") {
      throw new RangeError("This game has already started; use a resume token");
    }
    if (
      Object.keys(room.state.players).length >= room.state.rulesetSnapshot.players.count
    ) {
      throw new RangeError("Room is full");
    }

    const playerId = randomUUID();
    const playerToken = randomBytes(32).toString("base64url");
    await room.addPlayer(playerId, name, at);
    this.store.saveSession({
      roomId,
      playerId,
      tokenHash: tokenHash(playerToken),
      displayName: name,
      at,
    });
    return { roomId, playerId, playerToken, resumed: false };
  }

  authenticate(roomId: string, playerToken: string): string | null {
    return (
      this.store.findSession(roomId.toUpperCase(), tokenHash(playerToken))?.playerId ??
      null
    );
  }

  async addBot(
    roomId: string,
    seat: number,
    difficulty: BotDifficulty,
    at = new Date().toISOString(),
  ): Promise<string> {
    const room = this.getRoom(roomId);
    if (room === null) throw new RangeError("Room not found");
    const botCount = Object.values(room.state.players).filter(
      ({ bot }) => bot !== undefined,
    ).length;
    return room.addBot(BOT_NAMES[botCount % BOT_NAMES.length]!, seat, difficulty, at);
  }

  roomSummary(state: Readonly<GameState>) {
    return {
      roomId: state.roomId,
      phase: state.phase,
      revision: state.revision,
      ruleset: {
        id: state.rulesetSnapshot.id,
        name: state.rulesetSnapshot.name,
        players: state.rulesetSnapshot.players.count,
        decks: state.rulesetSnapshot.decks.count,
        presetId: state.presetId ?? DEFAULT_PRESET_ID,
        teamsMode: state.rulesetSnapshot.teams.mode,
      },
      seats: Array.from({ length: state.rulesetSnapshot.players.count }, (_, seat) => {
        const playerId = state.seats[seat] ?? null;
        return {
          seat,
          occupied: playerId !== null,
          name: playerId === null ? null : (state.players[playerId]?.name ?? null),
          isBot: playerId === null ? false : state.players[playerId]?.bot !== undefined,
        };
      }),
    };
  }

  close(): void {
    for (const room of this.rooms.values()) room.close();
  }
}
