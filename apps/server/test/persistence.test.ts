import { describe, expect, it } from "vitest";
import { SqliteStore } from "../src/persistence/sqlite-store.js";
import { RoomManager } from "../src/room-manager.js";

describe("SQLite room persistence", () => {
  it("persists room snapshots, events, and hashed resume sessions", async () => {
    const store = new SqliteStore(":memory:");
    const manager = new RoomManager(store);
    const room = await manager.createRoom("2026-06-19T12:00:00.000Z");
    const joined = await manager.joinRoom({
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
    // The first human join records PLAYER_JOINED plus the HOST_CHANGED that
    // makes them the room host.
    const eventCount = store.database
      .prepare("SELECT COUNT(*) AS count FROM room_events WHERE room_id = ?")
      .get(room.state.roomId) as { count: number };
    expect(eventCount.count).toBe(2);
    expect(store.loadRoom(room.state.roomId)?.hostPlayerId).toBe(joined.playerId);
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

  it("loads active rooms and resumes players after a manager restart", async () => {
    const store = new SqliteStore(":memory:");
    const firstManager = new RoomManager(store);
    const room = await firstManager.createRoom();
    const joined = await firstManager.joinRoom({
      roomId: room.state.roomId,
      name: "Lin",
    });
    firstManager.close();

    const restoredManager = new RoomManager(store);
    const restored = restoredManager.getRoom(room.state.roomId);
    expect(restored?.state.players[joined.playerId]?.name).toBe("Lin");
    const resumed = await restoredManager.joinRoom({
      roomId: room.state.roomId,
      name: "Ignored on resume",
      resumeToken: joined.playerToken,
    });
    expect(resumed).toMatchObject({ playerId: joined.playerId, resumed: true });

    restoredManager.close();
    store.close();
  });

  it("resumes a room created with a preset and options after a restart", async () => {
    const store = new SqliteStore(":memory:");
    const firstManager = new RoomManager(store, { timersEnabled: false });
    const room = await firstManager.createRoom({
      at: "2026-07-10T12:00:00.000Z",
      presetId: "shengji-6p-3d-fixed-experimental",
      options: { bottomSize: 12 },
    });
    const roomId = room.state.roomId;
    expect(room.state.rulesetSnapshot.players.count).toBe(6);
    expect(room.state.rulesetSnapshot.bottom.size).toBe(12);
    firstManager.close();

    const restoredManager = new RoomManager(store, { timersEnabled: false });
    const restored = restoredManager.getRoom(roomId);
    expect(restored?.state.rulesetSnapshot.players.count).toBe(6);
    expect(restored?.state.rulesetSnapshot.bottom.size).toBe(12);
    expect(restored?.state.presetId).toBe("shengji-6p-3d-fixed-experimental");
    // Migration stamps the schema version on load.
    expect(store.loadRoom(roomId)?.schemaVersion).toBe(1);

    restoredManager.close();
    store.close();
  });
});
