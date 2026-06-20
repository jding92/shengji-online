import { describe, expect, it } from "vitest";
import { SqliteStore } from "../src/persistence/sqlite-store.js";
import { RoomManager } from "../src/room-manager.js";

describe("SQLite room persistence", () => {
  it("persists room snapshots, events, and hashed resume sessions", () => {
    const store = new SqliteStore(":memory:");
    const manager = new RoomManager(store);
    const room = manager.createRoom("2026-06-19T12:00:00.000Z");
    const joined = manager.joinRoom({
      roomId: room.state.roomId,
      name: "Ada",
      at: "2026-06-19T12:00:01.000Z",
    });

    expect(manager.authenticate(room.state.roomId, joined.playerToken)).toBe(
      joined.playerId,
    );
    expect(store.loadRoom(room.state.roomId)?.players[joined.playerId]?.name).toBe(
      "Ada",
    );
    const eventCount = store.database
      .prepare("SELECT COUNT(*) AS count FROM room_events WHERE room_id = ?")
      .get(room.state.roomId) as { count: number };
    expect(eventCount.count).toBe(1);
    const storedToken = store.database
      .prepare(
        "SELECT resume_token_hash FROM player_sessions WHERE room_id = ? AND player_id = ?",
      )
      .get(room.state.roomId, joined.playerId) as { resume_token_hash: string };
    expect(storedToken.resume_token_hash).not.toBe(joined.playerToken);
    expect(storedToken.resume_token_hash).toMatch(/^[a-f\d]{64}$/);

    manager.close();
    store.close();
  });

  it("loads active rooms and resumes players after a manager restart", () => {
    const store = new SqliteStore(":memory:");
    const firstManager = new RoomManager(store);
    const room = firstManager.createRoom();
    const joined = firstManager.joinRoom({ roomId: room.state.roomId, name: "Lin" });
    firstManager.close();

    const restoredManager = new RoomManager(store);
    const restored = restoredManager.getRoom(room.state.roomId);
    expect(restored?.state.players[joined.playerId]?.name).toBe("Lin");
    const resumed = restoredManager.joinRoom({
      roomId: room.state.roomId,
      name: "Ignored on resume",
      resumeToken: joined.playerToken,
    });
    expect(resumed).toMatchObject({ playerId: joined.playerId, resumed: true });

    restoredManager.close();
    store.close();
  });
});
