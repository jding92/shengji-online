import { randomUUID } from "node:crypto";
import {
  CommandValidationError,
  getFinalizeBiddingEvents,
  getNextDealEvents,
  replayEvents,
  validateCommand,
  type ClientCommand,
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

type RoomOptions = {
  timersEnabled?: boolean;
  dealIntervalMs?: number;
};

export class Room {
  private queue: Promise<void> = Promise.resolve();
  private readonly connections = new Map<string, Set<WebSocket>>();
  private readonly processedRequests = new Map<string, Set<string>>();
  private dealTimer?: NodeJS.Timeout;
  private bidTimer?: NodeJS.Timeout;
  private tickTimer?: NodeJS.Timeout;
  private readonly timersEnabled: boolean;
  private readonly dealIntervalMs: number;

  constructor(
    private currentState: GameState,
    private readonly store: SqliteStore,
    options: RoomOptions = {},
  ) {
    this.timersEnabled = options.timersEnabled ?? true;
    this.dealIntervalMs =
      options.dealIntervalMs ??
      Number.parseInt(process.env.DEAL_INTERVAL_MS ?? "45", 10);
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

  private clearTimers(): void {
    if (this.dealTimer !== undefined) clearTimeout(this.dealTimer);
    if (this.bidTimer !== undefined) clearTimeout(this.bidTimer);
    if (this.tickTimer !== undefined) clearInterval(this.tickTimer);
    delete this.dealTimer;
    delete this.bidTimer;
    delete this.tickTimer;
  }

  private rescheduleTimers(): void {
    this.clearTimers();
    if (!this.timersEnabled) return;
    if (this.currentState.phase === "dealing") {
      this.dealTimer = setTimeout(() => {
        void this.serialize(() => {
          this.commit(getNextDealEvents(this.currentState, new Date().toISOString()));
          this.rescheduleTimers();
        });
      }, this.dealIntervalMs);
      return;
    }
    const deadline = this.currentState.round?.biddingDeadline;
    if (this.currentState.phase !== "post-deal-bidding" || deadline === undefined)
      return;
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
    if (envelope.expectedRevision !== this.currentState.revision) {
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
      if (this.currentState.players[playerId]?.connected === false) {
        this.commit([
          {
            type: "PLAYER_CONNECTION_CHANGED",
            playerId,
            connected: true,
            at: new Date().toISOString(),
          },
        ]);
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
        }
      });
    });
  }

  addPlayer(playerId: string, name: string, at: string): void {
    this.commit([{ type: "PLAYER_JOINED", playerId, name, at }]);
  }

  close(): void {
    this.clearTimers();
    for (const sockets of this.connections.values()) {
      for (const socket of sockets) socket.close(1001, "Server shutting down");
    }
  }
}
