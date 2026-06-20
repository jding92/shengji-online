import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { GameEvent, GameState } from "@shengji/engine";

type RoomRow = { latest_snapshot_json: string };
type SessionRow = { player_id: string; display_name: string };

export type StoredSession = {
  playerId: string;
  displayName: string;
};

export class SqliteStore {
  readonly database: DatabaseSync;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.database = new DatabaseSync(path);
    this.database.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
    this.migrate();
  }

  private migrate(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        status TEXT NOT NULL,
        latest_revision INTEGER NOT NULL,
        ruleset_id TEXT NOT NULL,
        ruleset_snapshot_json TEXT NOT NULL,
        latest_snapshot_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS room_events (
        room_id TEXT NOT NULL,
        revision INTEGER NOT NULL,
        event_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (room_id, revision),
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS player_sessions (
        room_id TEXT NOT NULL,
        player_id TEXT NOT NULL,
        resume_token_hash TEXT NOT NULL,
        seat INTEGER,
        display_name TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        PRIMARY KEY (room_id, player_id),
        UNIQUE (room_id, resume_token_hash),
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
      );
    `);
  }

  createRoom(state: GameState): void {
    this.database
      .prepare(
        `INSERT INTO rooms (
          id, created_at, updated_at, status, latest_revision,
          ruleset_id, ruleset_snapshot_json, latest_snapshot_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        state.roomId,
        state.createdAt,
        state.updatedAt,
        state.phase,
        state.revision,
        state.rulesetId,
        JSON.stringify(state.rulesetSnapshot),
        JSON.stringify(state),
      );
  }

  appendEvents(
    previousRevision: number,
    events: readonly GameEvent[],
    nextState: GameState,
  ): void {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const insert = this.database.prepare(
        `INSERT INTO room_events (room_id, revision, event_json, created_at)
         VALUES (?, ?, ?, ?)`,
      );
      events.forEach((event, index) => {
        insert.run(
          nextState.roomId,
          previousRevision + index + 1,
          JSON.stringify(event),
          event.at,
        );
      });
      const result = this.database
        .prepare(
          `UPDATE rooms
           SET updated_at = ?, status = ?, latest_revision = ?, latest_snapshot_json = ?
           WHERE id = ? AND latest_revision = ?`,
        )
        .run(
          nextState.updatedAt,
          nextState.phase,
          nextState.revision,
          JSON.stringify(nextState),
          nextState.roomId,
          previousRevision,
        );
      if (result.changes !== 1) throw new Error("Room snapshot revision conflict");
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  loadRoom(roomId: string): GameState | null {
    const row = this.database
      .prepare("SELECT latest_snapshot_json FROM rooms WHERE id = ?")
      .get(roomId) as RoomRow | undefined;
    return row === undefined
      ? null
      : (JSON.parse(row.latest_snapshot_json) as GameState);
  }

  loadActiveRooms(): GameState[] {
    const rows = this.database
      .prepare("SELECT latest_snapshot_json FROM rooms WHERE status != 'game-over'")
      .all() as unknown as RoomRow[];
    return rows.map(
      ({ latest_snapshot_json }) => JSON.parse(latest_snapshot_json) as GameState,
    );
  }

  saveSession(input: {
    roomId: string;
    playerId: string;
    tokenHash: string;
    displayName: string;
    at: string;
  }): void {
    this.database
      .prepare(
        `INSERT INTO player_sessions (
          room_id, player_id, resume_token_hash, display_name, last_seen_at
        ) VALUES (?, ?, ?, ?, ?)`,
      )
      .run(input.roomId, input.playerId, input.tokenHash, input.displayName, input.at);
  }

  findSession(roomId: string, tokenHash: string): StoredSession | null {
    const row = this.database
      .prepare(
        `SELECT player_id, display_name FROM player_sessions
         WHERE room_id = ? AND resume_token_hash = ?`,
      )
      .get(roomId, tokenHash) as SessionRow | undefined;
    return row === undefined
      ? null
      : { playerId: row.player_id, displayName: row.display_name };
  }

  touchSession(
    roomId: string,
    playerId: string,
    seat: number | null,
    at: string,
  ): void {
    this.database
      .prepare(
        `UPDATE player_sessions SET seat = ?, last_seen_at = ?
         WHERE room_id = ? AND player_id = ?`,
      )
      .run(seat, at, roomId, playerId);
  }

  close(): void {
    this.database.close();
  }
}
