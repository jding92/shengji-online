import { describe, expect, it } from "vitest";
import {
  applyEvent,
  createGameState,
  DEFAULT_PRESET_ID,
  fourPlayerTwoDeckFixedTeamRuleset,
  replayEvents,
  resolveRuleset,
  validateCommand,
  type GameEvent,
  type GameOptions,
  type GameState,
} from "../src/index.js";

const now = "2026-07-10T12:00:00.000Z";

/** Lobby with `seatCount` seats, `host` as host, and `seated` players seated. */
function lobby(input: {
  seatCount: number;
  options?: GameOptions;
  seated: number[];
  host: string;
}): GameState {
  const resolved = resolveRuleset(DEFAULT_PRESET_ID, input.options ?? {});
  if (!resolved.ok) throw new Error("fixture ruleset failed to resolve");
  let state = createGameState({
    roomId: "OPTS",
    ruleset: resolved.ruleset,
    createdAt: now,
    presetId: DEFAULT_PRESET_ID,
    pendingOptions: input.options ?? {},
  });
  for (const seat of input.seated) {
    const playerId = `p${seat}`;
    state = applyEvent(state, {
      type: "PLAYER_JOINED",
      playerId,
      name: `Player ${seat}`,
      at: now,
    });
    state = replayEvents(
      state,
      validateCommand(state, playerId, { type: "SIT", seat }, { now }),
    );
  }
  state = applyEvent(state, { type: "HOST_CHANGED", playerId: input.host, at: now });
  return state;
}

describe("UPDATE_OPTIONS command", () => {
  it("lets only the host change options", () => {
    const state = lobby({ seatCount: 4, seated: [0, 1], host: "p0" });
    expect(() =>
      validateCommand(
        state,
        "p1",
        { type: "UPDATE_OPTIONS", options: { maxRedeals: 4 } },
        { now },
      ),
    ).toThrow("Only the host");
    const events = validateCommand(
      state,
      "p0",
      { type: "UPDATE_OPTIONS", options: { maxRedeals: 4 } },
      { now },
    );
    expect(events[0]).toMatchObject({
      type: "OPTIONS_UPDATED",
      presetId: DEFAULT_PRESET_ID,
    });
  });

  it("rejects a structural change outside the lobby", () => {
    // Phase 4 narrows this from "outside the lobby, full stop" to "outside
    // the lobby, unless every changed key is in-game-editable" — see the
    // dedicated in-game describe block below for the accepted case.
    const state: GameState = {
      ...lobby({ seatCount: 4, seated: [0], host: "p0" }),
      phase: "playing",
    };
    expect(() =>
      validateCommand(
        state,
        "p0",
        { type: "UPDATE_OPTIONS", options: { maxRedeals: 4 } },
        { now },
      ),
    ).toThrow("lobby");
  });

  it("carries the resolved ruleset and un-readies everyone on apply", () => {
    let state = lobby({ seatCount: 4, seated: [0, 1, 2, 3], host: "p0" });
    // Ready two of four so the table stays in the lobby.
    for (const playerId of ["p1", "p2"]) {
      state = applyEvent(state, {
        type: "PLAYER_READY_CHANGED",
        playerId,
        ready: true,
        at: now,
      });
    }
    expect(state.players["p1"]?.ready).toBe(true);

    const events = validateCommand(
      state,
      "p0",
      { type: "UPDATE_OPTIONS", options: { scoring: { bandSize: 50 } } },
      { now },
    );
    const optionsUpdated = events[0] as Extract<GameEvent, { type: "OPTIONS_UPDATED" }>;
    expect(optionsUpdated.ruleset.scoring.thresholds[1]?.maxExclusive).toBe(50);
    expect(optionsUpdated.ruleset.id).toBe(`${DEFAULT_PRESET_ID}+custom`);

    const applied = replayEvents(state, events);
    expect(applied.rulesetSnapshot.scoring.thresholds[1]?.maxExclusive).toBe(50);
    expect(applied.rulesetId).toBe(`${DEFAULT_PRESET_ID}+custom`);
    expect(Object.values(applied.players).every((player) => !player.ready)).toBe(true);
    expect(applied.pendingOptions).toEqual({ scoring: { bandSize: 50 } });
  });

  it("rejects shrinking below an occupied seat, listing the conflicts", () => {
    // A 6-seat lobby with a player parked in seat 5; shrinking to 4p conflicts.
    const state = lobby({
      seatCount: 6,
      options: { playerCount: 6, deckCount: 3 },
      seated: [0, 5],
      host: "p0",
    });
    expect(() =>
      validateCommand(
        state,
        "p0",
        { type: "UPDATE_OPTIONS", presetId: DEFAULT_PRESET_ID, options: {} },
        { now },
      ),
    ).toThrow("seat(s) 5");
  });

  it("rejects shrinking below the number of joined players", () => {
    let state = lobby({
      seatCount: 8,
      options: { playerCount: 8, deckCount: 4 },
      seated: [0],
      host: "p0",
    });
    for (let index = 1; index < 5; index += 1) {
      state = applyEvent(state, {
        type: "PLAYER_JOINED",
        playerId: `p${index}`,
        name: `Player ${index}`,
        at: now,
      });
    }

    expect(() =>
      validateCommand(
        state,
        "p0",
        { type: "UPDATE_OPTIONS", options: { playerCount: 4, deckCount: 2 } },
        { now },
      ),
    ).toThrow("Cannot shrink to 4 players while 5 players have joined");
  });

  it("resizes seats up and down while preserving assignments", () => {
    const state = lobby({ seatCount: 4, seated: [0, 1], host: "p0" });
    const grow = replayEvents(
      state,
      validateCommand(
        state,
        "p0",
        { type: "UPDATE_OPTIONS", options: { playerCount: 6, deckCount: 3 } },
        { now },
      ),
    );
    expect(Object.keys(grow.seats)).toHaveLength(6);
    expect(grow.seats[0]).toBe("p0");
    expect(grow.seats[1]).toBe("p1");
    expect(grow.seats[5]).toBeNull();
  });

  it("replays OPTIONS_UPDATED deterministically", () => {
    const state = lobby({ seatCount: 4, seated: [0], host: "p0" });
    const events = validateCommand(
      state,
      "p0",
      { type: "UPDATE_OPTIONS", options: { maxRedeals: 5 } },
      { now },
    );
    expect(replayEvents(state, events)).toEqual(replayEvents(state, events));
  });
});

describe("UPDATE_OPTIONS command in-game (Phase 4)", () => {
  it("accepts a timer-only diff mid-round without touching seats or ready", () => {
    let state = lobby({ seatCount: 4, seated: [0, 1, 2, 3], host: "p0" });
    for (const playerId of ["p1", "p2"]) {
      state = applyEvent(state, {
        type: "PLAYER_READY_CHANGED",
        playerId,
        ready: true,
        at: now,
      });
    }
    const midRound: GameState = { ...state, phase: "playing" };

    const events = validateCommand(
      midRound,
      "p0",
      { type: "UPDATE_OPTIONS", options: { timers: { playTimeoutSeconds: 45 } } },
      { now },
    );
    const optionsUpdated = events[0] as Extract<GameEvent, { type: "OPTIONS_UPDATED" }>;
    expect(optionsUpdated.ruleset.turns.playTimeoutSeconds).toBe(45);

    const applied = replayEvents(midRound, events);
    expect(applied.phase).toBe("playing");
    expect(applied.seats).toEqual(midRound.seats);
    expect(applied.players["p1"]?.ready).toBe(true);
    expect(applied.players["p2"]?.ready).toBe(true);
    expect(applied.rulesetSnapshot.turns.playTimeoutSeconds).toBe(45);
  });

  it("rejects a mixed timer + structural diff mid-round, naming the offender", () => {
    const state = lobby({ seatCount: 4, seated: [0], host: "p0" });
    const midRound: GameState = { ...state, phase: "playing" };
    expect(() =>
      validateCommand(
        midRound,
        "p0",
        {
          type: "UPDATE_OPTIONS",
          options: { timers: { playTimeoutSeconds: 45 }, bottomSize: 10 },
        },
        { now },
      ),
    ).toThrow("bottomSize");
  });

  it("rejects a structural-only diff mid-round", () => {
    const state = lobby({ seatCount: 4, seated: [0], host: "p0" });
    const midRound: GameState = { ...state, phase: "bottom-exchange" };
    expect(() =>
      validateCommand(
        midRound,
        "p0",
        { type: "UPDATE_OPTIONS", options: { maxRedeals: 5 } },
        { now },
      ),
    ).toThrow("maxRedeals");
  });

  it("rejects a preset switch mid-round even when the options diff is timer-only", () => {
    const state = lobby({ seatCount: 4, seated: [0], host: "p0" });
    const midRound: GameState = { ...state, phase: "playing" };
    expect(() =>
      validateCommand(
        midRound,
        "p0",
        {
          type: "UPDATE_OPTIONS",
          presetId: "shengji-6p-3d-fixed-v1",
          options: {},
        },
        { now },
      ),
    ).toThrow("preset");
  });

  it("rejects UPDATE_OPTIONS once the game has ended", () => {
    const state = lobby({ seatCount: 4, seated: [0], host: "p0" });
    const finished: GameState = { ...state, phase: "game-over" };
    expect(() =>
      validateCommand(
        finished,
        "p0",
        { type: "UPDATE_OPTIONS", options: { timers: { playTimeoutSeconds: 45 } } },
        { now },
      ),
    ).toThrow("ended");
  });

  it("still requires the host in-game", () => {
    const state = lobby({ seatCount: 4, seated: [0, 1], host: "p0" });
    const midRound: GameState = { ...state, phase: "playing" };
    expect(() =>
      validateCommand(
        midRound,
        "p1",
        { type: "UPDATE_OPTIONS", options: { timers: { playTimeoutSeconds: 45 } } },
        { now },
      ),
    ).toThrow("Only the host");
  });

  it("existing lobby behavior is unchanged (regression)", () => {
    const state = lobby({ seatCount: 4, seated: [0, 1, 2, 3], host: "p0" });
    const events = validateCommand(
      state,
      "p0",
      { type: "UPDATE_OPTIONS", options: { playerCount: 6, deckCount: 3 } },
      { now },
    );
    const applied = replayEvents(state, events);
    expect(applied.rulesetSnapshot.players.count).toBe(6);
    expect(Object.keys(applied.seats)).toHaveLength(6);
  });
});

describe("HOST_CHANGED reducer", () => {
  it("sets the host player id", () => {
    let state = createGameState({
      roomId: "HOST",
      ruleset: fourPlayerTwoDeckFixedTeamRuleset,
      createdAt: now,
    });
    expect(state.hostPlayerId).toBeUndefined();
    state = applyEvent(state, { type: "HOST_CHANGED", playerId: "human-1", at: now });
    expect(state.hostPlayerId).toBe("human-1");
  });
});
