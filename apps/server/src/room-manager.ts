import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  createGameState,
  fourPlayerTwoDeckFixedTeamRuleset,
  type GameState,
} from "@shengji/engine";
import { Room } from "./room.js";
import type { SqliteStore } from "./persistence/sqlite-store.js";

const ROOM_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function roomCode(): string {
  const bytes = randomBytes(6);
  return [...bytes].map((byte) => ROOM_ALPHABET[byte % ROOM_ALPHABET.length]).join("");
}

export type JoinResult = {
  roomId: string;
  playerId: string;
  playerToken: string;
  resumed: boolean;
};

export class RoomManager {
  private readonly rooms = new Map<string, Room>();

  constructor(private readonly store: SqliteStore) {
    for (const state of store.loadActiveRooms()) {
      this.rooms.set(state.roomId, new Room(state, store));
    }
  }

  createRoom(at = new Date().toISOString()): Room {
    let roomId = roomCode();
    while (this.rooms.has(roomId) || this.store.loadRoom(roomId) !== null)
      roomId = roomCode();
    const ruleset = structuredClone(fourPlayerTwoDeckFixedTeamRuleset);
    if (process.env.BID_POST_DEAL_SECONDS !== undefined) {
      ruleset.bidding.postDealWindowSeconds = Number.parseInt(
        process.env.BID_POST_DEAL_SECONDS,
        10,
      );
    }
    if (process.env.BID_RESPONSE_SECONDS !== undefined) {
      ruleset.bidding.responseWindowSeconds = Number.parseInt(
        process.env.BID_RESPONSE_SECONDS,
        10,
      );
    }
    const state = createGameState({
      roomId,
      ruleset,
      createdAt: at,
    });
    this.store.createRoom(state);
    const room = new Room(state, this.store);
    this.rooms.set(roomId, room);
    return room;
  }

  getRoom(roomId: string): Room | null {
    return this.rooms.get(roomId.toUpperCase()) ?? null;
  }

  joinRoom(input: {
    roomId: string;
    name: string;
    resumeToken?: string;
    at?: string;
  }): JoinResult {
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
    room.addPlayer(playerId, name, at);
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
      },
      seats: Array.from({ length: state.rulesetSnapshot.players.count }, (_, seat) => {
        const playerId = state.seats[seat] ?? null;
        return {
          seat,
          occupied: playerId !== null,
          name: playerId === null ? null : (state.players[playerId]?.name ?? null),
        };
      }),
    };
  }

  close(): void {
    for (const room of this.rooms.values()) room.close();
  }
}
