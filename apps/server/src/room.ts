import { randomUUID } from "node:crypto";
import {
  botConfigForDifficulty,
  CommandValidationError,
  decideBotAction,
  deriveBotObservation,
  finishRoundEvents,
  getAutoStartNextRoundEvents,
  getFinalizeBiddingEvents,
  getForcedFriendCallEvents,
  getForcedPlayEvents,
  getNextDealEvents,
  replayEvents,
  validateCommand,
  type ClientCommand,
  type BotDifficulty,
  type GameEvent,
  type GameState,
} from "@shengji/engine";
import {
  PROTOCOL_VERSION,
  clientEnvelopeSchema,
  type ClientEnvelope,
  type ServerEnvelope,
} from "@shengji/protocol";
import WebSocket from "ws";
import { derivePrivateView } from "./private-views/derive-private-view.js";
import type { SqliteStore } from "./persistence/sqlite-store.js";

export type RoomOptions = {
  timersEnabled?: boolean;
  dealIntervalMs?: number;
  /** Test override for turn timeouts; defaults to the ruleset's seconds. */
  turnTimeoutMsOverride?: { connected: number; disconnected: number };
  /** Test override for ordinary bot decisions, including bidding and play. */
  botDelayMsOverride?: { min: number; max: number };
  /** Round summaries linger longer than ordinary bot decisions. */
  botNextRoundDelayMs?: number;
};

type PendingBotTimer = {
  key: string;
  timer: NodeJS.Timeout;
};

export class Room {
  private queue: Promise<void> = Promise.resolve();
  private readonly connections = new Map<string, Set<WebSocket>>();
  private readonly processedRequests = new Map<string, Set<string>>();
  private dealTimer?: NodeJS.Timeout;
  private bidTimer?: NodeJS.Timeout;
  private turnTimer?: NodeJS.Timeout;
  private tickTimer?: NodeJS.Timeout;
  private readonly botTimers = new Map<string, PendingBotTimer>();
  private readonly timersEnabled: boolean;
  private readonly dealIntervalMs: number;
  private readonly turnTimeoutMsOverride?: {
    connected: number;
    disconnected: number;
  };
  private readonly botDelayMsOverride?: { min: number; max: number };
  private readonly botNextRoundDelayMs: number;

  constructor(
    private currentState: GameState,
    private readonly store: SqliteStore,
    options: RoomOptions = {},
  ) {
    this.timersEnabled = options.timersEnabled ?? true;
    this.dealIntervalMs =
      options.dealIntervalMs ??
      Number.parseInt(process.env.DEAL_INTERVAL_MS ?? "600", 10);
    if (options.turnTimeoutMsOverride !== undefined) {
      this.turnTimeoutMsOverride = options.turnTimeoutMsOverride;
    }
    if (options.botDelayMsOverride !== undefined) {
      this.botDelayMsOverride = options.botDelayMsOverride;
    }
    this.botNextRoundDelayMs = options.botNextRoundDelayMs ?? 10_000;
    this.rescheduleTimers();
  }

  get state(): Readonly<GameState> {
    return this.currentState;
  }

  private serialize<T>(task: () => T | Promise<T>): Promise<T> {
    const result = this.queue.then(task, task);
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private send(socket: WebSocket, envelope: ServerEnvelope): void {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(envelope));
  }

  sendSnapshot(playerId: string, socket: WebSocket): void {
    this.send(socket, {
      type: "SNAPSHOT",
      protocolVersion: PROTOCOL_VERSION,
      revision: this.currentState.revision,
      view: derivePrivateView(this.currentState, playerId),
    });
  }

  private broadcastSnapshots(): void {
    for (const [playerId, sockets] of this.connections) {
      for (const socket of sockets) this.sendSnapshot(playerId, socket);
    }
  }

  private commit(events: readonly GameEvent[]): void {
    if (events.length === 0) return;
    const previousRevision = this.currentState.revision;
    const nextState = replayEvents(this.currentState, events);
    this.store.appendEvents(previousRevision, events, nextState);
    this.currentState = nextState;
    this.broadcastSnapshots();
  }

  private clearGameTimers(): void {
    if (this.dealTimer !== undefined) clearTimeout(this.dealTimer);
    if (this.bidTimer !== undefined) clearTimeout(this.bidTimer);
    if (this.turnTimer !== undefined) clearTimeout(this.turnTimer);
    if (this.tickTimer !== undefined) clearInterval(this.tickTimer);
    delete this.dealTimer;
    delete this.bidTimer;
    delete this.turnTimer;
    delete this.tickTimer;
  }

  private clearBotTimers(): void {
    for (const { timer } of this.botTimers.values()) clearTimeout(timer);
    this.botTimers.clear();
  }

  private clearTimers(): void {
    this.clearGameTimers();
    this.clearBotTimers();
  }

  private startTicking(deadline: string): void {
    this.tickTimer = setInterval(() => {
      const tick: ServerEnvelope = {
        type: "TIMER_TICK",
        protocolVersion: PROTOCOL_VERSION,
        deadline,
        serverTime: new Date().toISOString(),
      };
      for (const sockets of this.connections.values()) {
        for (const socket of sockets) this.send(socket, tick);
      }
    }, 1_000);
  }

  private rescheduleTimers(): void {
    this.clearGameTimers();
    // Self-heal: a restored or interrupted room whose final trick already
    // completed can sit in "playing" with empty hands and no outcome.
    if (this.currentState.phase === "playing") {
      this.commit(finishRoundEvents(this.currentState, new Date().toISOString()));
    }
    if (!this.timersEnabled) {
      this.clearBotTimers();
      return;
    }
    if (this.currentState.phase === "dealing") {
      this.dealTimer = setTimeout(() => {
        void this.serialize(() => {
          this.commit(getNextDealEvents(this.currentState, new Date().toISOString()));
          this.rescheduleTimers();
        });
      }, this.dealIntervalMs);
    } else if (this.currentState.phase === "post-deal-bidding") {
      const deadline = this.currentState.round?.biddingDeadline;
      if (deadline !== undefined) {
        const remaining = Math.max(0, Date.parse(deadline) - Date.now());
        this.bidTimer = setTimeout(() => {
          void this.serialize(() => {
            this.commit(
              getFinalizeBiddingEvents(
                this.currentState,
                new Date().toISOString(),
                randomUUID(),
              ),
            );
            this.rescheduleTimers();
          });
        }, remaining);
        this.startTicking(deadline);
      }
    } else {
      this.scheduleTurnTimeout();
    }
    this.scheduleBotActions();
  }

  private botActionKey(playerId: string): string | null {
    const state = this.currentState;
    const player = state.players[playerId];
    const seat = player?.seat;
    const round = state.round;
    if (player?.bot === undefined || seat === null || seat === undefined) {
      return null;
    }
    if (state.phase === "dealing" || state.phase === "post-deal-bidding") {
      if (
        round === undefined ||
        round.currentBid?.seat === seat ||
        (state.phase === "post-deal-bidding" && round.passedBidSeats.includes(seat))
      ) {
        return null;
      }
      const bidKey =
        round.currentBid === undefined
          ? "none"
          : `${round.currentBid.seat}:${round.currentBid.count}:${JSON.stringify(round.currentBid.face)}`;
      return `${state.phase}:${round.roundNumber}:${round.redealCount}:${bidKey}`;
    }
    if (state.phase === "bottom-exchange") {
      return state.leaderSeat === seat
        ? `bottom-exchange:${round?.roundNumber ?? 0}`
        : null;
    }
    if (state.phase === "friend-calling") {
      return round?.declarerSeat === seat
        ? `friend-calling:${round.roundNumber}`
        : null;
    }
    if (state.phase === "playing") {
      if (round?.currentTurnSeat !== seat) return null;
      return `playing:${round.roundNumber}:${round.completedTricks.length}:${round.currentTrick?.plays.length ?? 0}`;
    }
    if (state.phase === "round-scoring") {
      return state.leaderSeat === seat
        ? `round-scoring:${round?.roundNumber ?? 0}`
        : null;
    }
    return null;
  }

  private botDelayMs(): number {
    const range =
      this.botDelayMsOverride ??
      (this.currentState.phase === "bottom-exchange" ||
      this.currentState.phase === "friend-calling"
        ? { min: 2_000, max: 4_000 }
        : { min: 600, max: 1_500 });
    const minimum = Math.max(0, Math.min(range.min, range.max));
    const maximum = Math.max(minimum, Math.max(range.min, range.max));
    return Math.round(minimum + Math.random() * (maximum - minimum));
  }

  private scheduleBotActions(): void {
    const actionable = new Map<string, string>();
    for (const player of Object.values(this.currentState.players)) {
      const key = this.botActionKey(player.id);
      if (key !== null) actionable.set(player.id, key);
    }

    for (const [playerId, pending] of this.botTimers) {
      if (actionable.get(playerId) !== pending.key) {
        clearTimeout(pending.timer);
        this.botTimers.delete(playerId);
      }
    }
    for (const [playerId, key] of actionable) {
      if (this.botTimers.has(playerId)) continue;
      const delay =
        this.currentState.phase === "round-scoring"
          ? this.botNextRoundDelayMs
          : this.botDelayMs();
      const pending: PendingBotTimer = {
        key,
        timer: setTimeout(() => {
          void this.serialize(() => {
            if (this.botTimers.get(playerId) !== pending) return;
            this.botTimers.delete(playerId);
            this.runBotDecision(playerId);
          });
        }, delay),
      };
      this.botTimers.set(playerId, pending);
    }
  }

  private runBotDecision(playerId: string): void {
    const player = this.currentState.players[playerId];
    if (player?.bot === undefined || this.botActionKey(playerId) === null) return;
    const now = new Date().toISOString();
    try {
      const command = decideBotAction(
        deriveBotObservation(this.currentState, playerId),
        botConfigForDifficulty(player.bot.difficulty),
        `${this.currentState.roomId}:${playerId}:${this.currentState.revision}`,
      );
      if (command === null) return;
      this.commit(
        validateCommand(this.currentState, playerId, command, {
          now,
          roundSeed: randomUUID(),
        }),
      );
      this.rescheduleTimers();
    } catch (error) {
      console.error(
        `Bot decision failed for ${playerId} in room ${this.currentState.roomId}:`,
        error,
      );
      try {
        const fallback =
          this.currentState.phase === "friend-calling"
            ? getForcedFriendCallEvents(this.currentState, now)
            : getForcedPlayEvents(this.currentState, now);
        if (fallback.length > 0) {
          this.commit(fallback);
          this.rescheduleTimers();
        }
      } catch (fallbackError) {
        console.error(
          `Bot fallback failed for ${playerId} in room ${this.currentState.roomId}:`,
          fallbackError,
        );
      }
    }
  }

  /**
   * Acts for the current actor when their window expires — force-plays a
   * trick turn or bottom exchange, auto-calls friends for a stalled
   * finding-friends declarer, or starts the next round for an absent leader —
   * so a disconnected or idle player never stalls the game. Disconnected
   * players get the shorter window.
   */
  private scheduleTurnTimeout(): void {
    const state = this.currentState;
    if (
      state.phase !== "playing" &&
      state.phase !== "bottom-exchange" &&
      state.phase !== "friend-calling" &&
      state.phase !== "round-scoring"
    ) {
      return;
    }
    // The declarer is also this round's leaderSeat (set at TRUMP_FINALIZED),
    // so friend-calling shares the bottom-exchange/round-scoring branch below.
    const seat =
      state.phase === "playing" ? state.round?.currentTurnSeat : state.leaderSeat;
    if (seat === undefined) return;
    const playerId = state.seats[seat];
    if (playerId === null || playerId === undefined) return;
    const connected = state.players[playerId]?.connected === true;
    const { playTimeoutSeconds, disconnectedTimeoutSeconds } =
      state.rulesetSnapshot.turns;
    const timeoutMs = connected
      ? (this.turnTimeoutMsOverride?.connected ?? playTimeoutSeconds * 1_000)
      : (this.turnTimeoutMsOverride?.disconnected ??
        disconnectedTimeoutSeconds * 1_000);
    const deadline = new Date(Date.now() + timeoutMs).toISOString();
    this.turnTimer = setTimeout(() => {
      void this.serialize(() => {
        try {
          const now = new Date().toISOString();
          this.commit(
            this.currentState.phase === "round-scoring"
              ? getAutoStartNextRoundEvents(this.currentState, now, randomUUID())
              : this.currentState.phase === "friend-calling"
                ? getForcedFriendCallEvents(this.currentState, now)
                : getForcedPlayEvents(this.currentState, now),
          );
        } catch (error) {
          console.error(
            `Forced play failed in room ${this.currentState.roomId}:`,
            error,
          );
        }
        this.rescheduleTimers();
      });
    }, timeoutMs);
    this.startTicking(deadline);
  }

  private reject(
    socket: WebSocket,
    requestId: string,
    code: string,
    message: string,
  ): void {
    this.send(socket, {
      type: "COMMAND_REJECTED",
      protocolVersion: PROTOCOL_VERSION,
      requestId,
      code,
      message,
      revision: this.currentState.revision,
    });
  }

  private processEnvelope(
    playerId: string,
    socket: WebSocket,
    envelope: ClientEnvelope,
  ): void {
    if (envelope.roomId !== this.currentState.roomId) {
      this.reject(socket, envelope.requestId, "ROOM_MISMATCH", "Wrong room id");
      return;
    }
    let requests = this.processedRequests.get(playerId);
    if (requests === undefined) {
      requests = new Set();
      this.processedRequests.set(playerId, requests);
    }
    if (requests.has(envelope.requestId)) {
      this.sendSnapshot(playerId, socket);
      return;
    }
    // During the deal the revision advances every few milliseconds as cards
    // go out, so a client can never hold the current revision long enough to
    // bid. Commands are fully re-validated against the live state, so a
    // stale envelope is safe to accept here; every other phase keeps strict
    // optimistic concurrency.
    if (
      envelope.expectedRevision !== this.currentState.revision &&
      this.currentState.phase !== "dealing"
    ) {
      this.reject(
        socket,
        envelope.requestId,
        "STALE_REVISION",
        `Expected revision ${envelope.expectedRevision}, current revision is ${this.currentState.revision}`,
      );
      this.sendSnapshot(playerId, socket);
      return;
    }

    try {
      const events = validateCommand(
        this.currentState,
        playerId,
        envelope.command as ClientCommand,
        { now: new Date().toISOString(), roundSeed: randomUUID() },
      );
      this.commit(events);
      requests.add(envelope.requestId);
      const seat = this.currentState.players[playerId]?.seat ?? null;
      this.store.touchSession(
        this.currentState.roomId,
        playerId,
        seat,
        new Date().toISOString(),
      );
      this.rescheduleTimers();
    } catch (error) {
      this.reject(
        socket,
        envelope.requestId,
        error instanceof CommandValidationError ? error.code : "COMMAND_FAILED",
        error instanceof Error ? error.message : "Command failed",
      );
    }
  }

  connect(playerId: string, socket: WebSocket): void {
    let sockets = this.connections.get(playerId);
    if (sockets === undefined) {
      sockets = new Set();
      this.connections.set(playerId, sockets);
    }
    sockets.add(socket);
    void this.serialize(() => {
      const player = this.currentState.players[playerId];
      const events: GameEvent[] = [];
      if (player?.bot !== undefined) {
        events.push({
          type: "PLAYER_CONTROL_CHANGED",
          playerId,
          at: new Date().toISOString(),
        });
      }
      if (player?.connected === false) {
        events.push({
          type: "PLAYER_CONNECTION_CHANGED",
          playerId,
          connected: true,
          at: new Date().toISOString(),
        });
      }
      if (events.length > 0) {
        this.commit(events);
        this.rescheduleTimers();
      }
      this.sendSnapshot(playerId, socket);
    });

    socket.on("message", (data) => {
      let parsedJson: unknown;
      try {
        const text = Buffer.isBuffer(data)
          ? data.toString("utf8")
          : Array.isArray(data)
            ? Buffer.concat(data).toString("utf8")
            : Buffer.from(data).toString("utf8");
        parsedJson = JSON.parse(text) as unknown;
      } catch {
        this.reject(socket, "unknown", "INVALID_JSON", "Message must be valid JSON");
        return;
      }
      const parsed = clientEnvelopeSchema.safeParse(parsedJson);
      if (!parsed.success) {
        this.reject(
          socket,
          "unknown",
          "INVALID_ENVELOPE",
          parsed.error.issues[0]?.message ?? "Invalid command envelope",
        );
        return;
      }
      void this.serialize(() => this.processEnvelope(playerId, socket, parsed.data));
    });

    socket.once("close", () => {
      sockets.delete(socket);
      if (sockets.size > 0) return;
      this.connections.delete(playerId);
      void this.serialize(() => {
        if (this.currentState.players[playerId]?.connected === true) {
          this.commit([
            {
              type: "PLAYER_CONNECTION_CHANGED",
              playerId,
              connected: false,
              at: new Date().toISOString(),
            },
          ]);
          // Shorten the current actor's window if it was them who left.
          this.rescheduleTimers();
        }
      });
    });
  }

  addPlayer(playerId: string, name: string, at: string): Promise<void> {
    return this.serialize(() => {
      if (this.currentState.phase !== "lobby") {
        throw new RangeError("This game has already started");
      }
      if (
        Object.keys(this.currentState.players).length >=
        this.currentState.rulesetSnapshot.players.count
      ) {
        throw new RangeError("Room is full");
      }
      const events: GameEvent[] = [{ type: "PLAYER_JOINED", playerId, name, at }];
      // The first human to join becomes the room host (bots are never host).
      if (this.currentState.hostPlayerId === undefined) {
        events.push({ type: "HOST_CHANGED", playerId, at });
      }
      this.commit(events);
    });
  }

  /** First non-bot player in insertion order, or undefined if none remain. */
  private firstHuman(state: GameState): string | undefined {
    return Object.values(state.players).find((player) => player.bot === undefined)?.id;
  }

  addBot(
    name: string,
    seat: number,
    difficulty: BotDifficulty,
    at: string,
    playerId = randomUUID(),
  ): Promise<string> {
    return this.serialize(() => {
      if (this.currentState.phase !== "lobby") {
        throw new RangeError("Bots can only be added in the lobby");
      }
      if (
        Object.keys(this.currentState.players).length >=
        this.currentState.rulesetSnapshot.players.count
      ) {
        throw new RangeError("Room is full");
      }
      const normalizedName = name.trim();
      if (normalizedName.length < 1 || normalizedName.length > 32) {
        throw new RangeError("Bot name must be between 1 and 32 characters");
      }
      const joined: GameEvent = {
        type: "PLAYER_JOINED",
        playerId,
        name: normalizedName,
        bot: { difficulty },
        at,
      };
      let preview = replayEvents(this.currentState, [joined]);
      const seated = validateCommand(
        preview,
        playerId,
        { type: "SIT", seat },
        { now: at },
      );
      preview = replayEvents(preview, seated);
      const ready = validateCommand(
        preview,
        playerId,
        { type: "READY" },
        { now: at, roundSeed: randomUUID() },
      );
      this.commit([joined, ...seated, ...ready]);
      this.rescheduleTimers();
      return playerId;
    });
  }

  removeBot(playerId: string, at: string): Promise<void> {
    return this.serialize(() => {
      if (this.currentState.phase !== "lobby") {
        throw new RangeError("Bots can only be removed in the lobby");
      }
      if (this.currentState.players[playerId]?.bot === undefined) {
        throw new RangeError("Player is not a bot");
      }
      const events: GameEvent[] = [{ type: "PLAYER_REMOVED", playerId, at }];
      // Defensive host migration: bots are never host today, but if the removed
      // player were host, reassign to the earliest-joined remaining human.
      if (this.currentState.hostPlayerId === playerId) {
        const preview = replayEvents(this.currentState, events);
        const nextHost = this.firstHuman(preview);
        if (nextHost !== undefined) {
          events.push({ type: "HOST_CHANGED", playerId: nextHost, at });
        }
      }
      this.commit(events);
      this.rescheduleTimers();
    });
  }

  takeoverByBot(
    playerId: string,
    difficulty: BotDifficulty,
    at: string,
  ): Promise<void> {
    return this.serialize(() => {
      const player = this.currentState.players[playerId];
      if (
        this.currentState.phase === "lobby" ||
        this.currentState.phase === "game-over"
      ) {
        throw new RangeError("Bot takeover is only available during a game");
      }
      if (player === undefined) throw new RangeError("Player not found");
      if (player.bot !== undefined) {
        throw new RangeError("Player is already a bot");
      }
      if (player.connected) {
        throw new RangeError("Connected players cannot be replaced by a bot");
      }
      const connectedHumanRemains = Object.values(this.currentState.players).some(
        (candidate) =>
          candidate.id !== playerId &&
          candidate.bot === undefined &&
          candidate.connected,
      );
      if (!connectedHumanRemains) {
        throw new RangeError("A connected human must remain at the table");
      }
      this.commit([
        {
          type: "PLAYER_CONTROL_CHANGED",
          playerId,
          bot: { difficulty },
          at,
        },
      ]);
      this.rescheduleTimers();
    });
  }

  close(): void {
    this.clearTimers();
    for (const sockets of this.connections.values()) {
      for (const socket of sockets) socket.close(1001, "Server shutting down");
    }
  }
}
