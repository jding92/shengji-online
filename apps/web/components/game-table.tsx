"use client";

import type {
  CardInstance,
  PrivateGameView,
  WireClientCommand,
} from "@shengji/protocol";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  canHandOutbid,
  cardFaceKey,
  getEffectiveSuit,
  parseThrow,
  parseTrickFormat,
  scoreRound,
  sumCardPoints,
} from "@shengji/engine";
import { useCardSelection } from "../hooks/use-card-selection";
import { useGameMoments } from "../hooks/use-game-moments";
import { useSoundEffects, useSoundPreference } from "../hooks/use-sound-effects";
import { ART_ASSET_IDS, artAssetPath, artAssetSrcSet } from "../lib/art-registry";
import { THROW_BANNER_MS, TRICK_WINNER_GLOW_MS } from "../lib/constants";
import {
  compareForHandDisplay,
  defendingTeamIdForRound,
  relativeSeatPosition,
  teamRoleForSeat,
  teamRoleForTeam,
} from "../lib/cards";
import { outcomeTeamForRound, resolveViewRuleset } from "../lib/rules";
import { relativeSeatIndex, seatSlots } from "../lib/table-layout";
import { teamClassForTeamId } from "../lib/strings";
import { CardBack, PlayingCard } from "./card";
import { FxCanvas } from "./fx-canvas";
import { GameDashboard } from "./game-dashboard";
import { HandActions } from "./hand-actions";
import { HandDock } from "./hand-dock";
import { MomentLayer } from "./moment-layer";
import { RoundSummaryModal } from "./round-summary-modal";
import { TableSeat } from "./table-seat";
import { TrickCenter } from "./trick-center";
import { ChromeButton } from "./ui-chrome";

type GameTableProps = {
  view: PrivateGameView;
  sendCommand: (command: WireClientCommand) => string | null;
  onLeave: () => void;
  turnDeadline: string | null;
  serverNow: () => number;
};

const TABLE_FELT_ASSET = "texture.table-felt" as const;
const BOARD_ART_STYLE = {
  "--table-felt-image": `image-set(url("${artAssetPath(TABLE_FELT_ASSET, 1)}") 1x, url("${artAssetPath(TABLE_FELT_ASSET, 2)}") 2x)`,
} as CSSProperties;

export function GameTable({
  view,
  sendCommand,
  onLeave,
  turnDeadline,
  serverNow,
}: GameTableProps) {
  const round = view.publicRound;
  const resolvedRuleset = resolveViewRuleset(view.ruleset);
  const playerCount = resolvedRuleset.players.count;
  const slots = useMemo(() => seatSlots(playerCount), [playerCount]);
  const pointThresholds = useMemo(() => {
    const thresholds = new Set<number>();
    for (const threshold of resolvedRuleset.scoring.thresholds) {
      if ("min" in threshold && threshold.min !== undefined) {
        thresholds.add(threshold.min);
      }
    }
    return [...thresholds].filter((threshold) => threshold > 0).sort((a, b) => a - b);
  }, [resolvedRuleset]);
  const pointMeterMax = Math.max(resolvedRuleset.decks.count * 100, ...pointThresholds);
  const pointToneThresholds = useMemo(() => {
    const thresholds: number[] = [];
    for (const threshold of resolvedRuleset.scoring.thresholds) {
      if (
        threshold.winner === "attackers" &&
        "min" in threshold &&
        threshold.min !== undefined
      ) {
        thresholds.push(threshold.min);
      }
    }
    return thresholds.sort((a, b) => a - b);
  }, [resolvedRuleset]);
  const lowToneThreshold = pointToneThresholds[0] ?? pointMeterMax;
  const highToneThreshold = pointToneThresholds[1] ?? lowToneThreshold;
  const startingRank = resolvedRuleset.ranks.sequence[0]!;
  const { moments, dismiss } = useGameMoments(view);
  useSoundEffects(moments);
  const { muted, toggleMuted } = useSoundPreference();
  const reducedMotion = useReducedMotion() ?? false;
  const splashPrefetched = useRef<HTMLImageElement[]>([]);
  const actions = useMemo(() => new Set(view.legalActions), [view.legalActions]);
  // Sort trump-aware: before a suit is declared, treat the level rank as
  // no-trump so level cards group with the jokers instead of their suits.
  const cards = useMemo(() => {
    const trump = round?.trumpSpec ?? {
      mode: "no-trump" as const,
      rank: round?.trumpRank ?? startingRank,
    };
    return [...view.you.hand].sort((a, b) => compareForHandDisplay(a, b, trump));
  }, [view.you.hand, round?.trumpSpec, round?.trumpRank, startingRank]);

  const requiredCardCount = round?.currentTrick?.cardCount;
  const selectionLimit =
    view.phase === "bottom-exchange" && actions.has("bury-bottom")
      ? view.ruleset.bottomSize
      : view.phase === "playing" && requiredCardCount !== undefined
        ? requiredCardCount
        : undefined;
  const { selected, selectedCards, toggle, clear } = useCardSelection(
    cards,
    selectionLimit,
  );

  // Would the current selection lead as a throw (multiple components)?
  // Only meaningful when leading; followers may legally mix suits when void.
  const selectionKind = useMemo((): "normal" | "throw" | "unleadable" => {
    const trump = round?.trumpSpec;
    if (trump === undefined || selectedCards.length < 2) return "normal";
    try {
      parseTrickFormat(selectedCards, trump);
      return "normal";
    } catch {
      try {
        return parseThrow(selectedCards, trump).components.length > 1
          ? "throw"
          : "normal";
      } catch {
        return "unleadable";
      }
    }
  }, [selectedCards, round?.trumpSpec]);

  // Decision hints: bid-eligible cards while bidding; led-suit cards on your
  // turn to follow. An empty set means anything goes.
  const hinted = useMemo(() => {
    const ids = new Set<string>();
    if (actions.has("bid")) {
      for (const card of cards) {
        if (card.face.kind === "joker" || card.face.rank === round?.trumpRank) {
          ids.add(card.id);
        }
      }
      return ids;
    }
    const leadPlay = round?.currentTrick?.plays[0];
    if (
      view.phase === "playing" &&
      round?.currentTurnSeat === view.you.seat &&
      leadPlay !== undefined &&
      leadPlay.cards[0] !== undefined &&
      round.trumpSpec !== undefined
    ) {
      const trump = round.trumpSpec;
      const ledSuit = getEffectiveSuit(leadPlay.cards[0], trump);
      const suitCards = cards.filter(
        (card) => getEffectiveSuit(card, trump) === ledSuit,
      );
      // Following a pair or tractor: hint only the pairs you hold in the led
      // suit (they're what the format obliges); otherwise the whole suit.
      const ledHasTuples = (() => {
        try {
          return parseTrickFormat(leadPlay.cards, trump).components.some(
            ({ tupleSize }) => tupleSize >= 2,
          );
        } catch {
          try {
            return parseThrow(leadPlay.cards, trump).components.some(
              ({ tupleSize }) => tupleSize >= 2,
            );
          } catch {
            return false;
          }
        }
      })();
      if (ledHasTuples) {
        const byFace = new Map<string, CardInstance[]>();
        for (const card of suitCards) {
          const key = cardFaceKey(card.face);
          byFace.set(key, [...(byFace.get(key) ?? []), card]);
        }
        for (const group of byFace.values()) {
          if (group.length >= 2) for (const card of group) ids.add(card.id);
        }
        if (ids.size > 0) return ids;
      }
      for (const card of suitCards) ids.add(card.id);
    }
    return ids;
  }, [actions, cards, round, view.phase, view.you.seat]);

  // The throw banner auto-dismisses and can be clicked away; the engine
  // keeps lastThrow for the whole round, so visibility is client-side.
  const throwKey = round?.lastThrow
    ? `${round.lastThrow.seat}:${round.lastThrow.kind}:${round.lastThrow.explanation}`
    : null;
  const [dismissedThrow, setDismissedThrow] = useState<string | null>(null);
  useEffect(() => {
    if (throwKey === null) return;
    const timer = setTimeout(() => setDismissedThrow(throwKey), THROW_BANNER_MS);
    return () => clearTimeout(timer);
  }, [throwKey]);

  const submit = useCallback(
    (command: WireClientCommand): string | null => {
      const requestId = sendCommand(command);
      if (requestId !== null) clear();
      return requestId;
    },
    [sendCommand, clear],
  );

  // Once post-deal bidding opens, pass automatically when no same-face group
  // in the private hand can legally beat or reinforce the standing bid.
  const autoPassedBid = useRef<string | null>(null);
  useEffect(() => {
    const currentBid = round?.currentBid;
    if (
      view.phase !== "post-deal-bidding" ||
      round === undefined ||
      currentBid === undefined ||
      view.you.seat === null ||
      !actions.has("pass-bid")
    ) {
      autoPassedBid.current = null;
      return;
    }
    const signature = `${currentBid.seat}:${cardFaceKey(currentBid.face)}:${currentBid.count}`;
    if (
      autoPassedBid.current !== signature &&
      !canHandOutbid({
        seat: view.you.seat,
        hand: view.you.hand,
        currentRank: round.trumpRank,
        currentBid,
        rules: resolvedRuleset.bidding,
      })
    ) {
      autoPassedBid.current = signature;
      submit({ type: "PASS_BID" });
    }
  }, [actions, round, submit, view.phase, view.you.hand, view.you.seat]);

  const [trickWinnerSeat, setTrickWinnerSeat] = useState<number | null>(null);
  const lastTrickWinnerMoment = useRef<string | null>(null);
  const trickWinnerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const trickMoment = [...moments]
      .reverse()
      .find((moment) => moment.type === "TRICK_WON");
    if (trickMoment === undefined || trickMoment.id === lastTrickWinnerMoment.current) {
      return;
    }
    lastTrickWinnerMoment.current = trickMoment.id;
    setTrickWinnerSeat(trickMoment.winnerSeat);
    if (trickWinnerTimer.current !== null) clearTimeout(trickWinnerTimer.current);
    trickWinnerTimer.current = setTimeout(() => {
      setTrickWinnerSeat(null);
      trickWinnerTimer.current = null;
    }, TRICK_WINNER_GLOW_MS);
  }, [moments]);
  useEffect(
    () => () => {
      if (trickWinnerTimer.current !== null) clearTimeout(trickWinnerTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (view.phase !== "playing" || splashPrefetched.current.length > 0) return;
    // The end-state splash is an emotional peak; prefetch both densities before
    // scoring so the modal does not pop from a blurry placeholder.
    splashPrefetched.current = [
      artAssetPath(ART_ASSET_IDS.splashVictory, 1),
      artAssetPath(ART_ASSET_IDS.splashVictory, 2),
      artAssetPath(ART_ASSET_IDS.splashDefeat, 1),
      artAssetPath(ART_ASSET_IDS.splashDefeat, 2),
    ].map((src) => {
      const image = new Image();
      image.src = src;
      return image;
    });
  }, [view.phase]);

  const primaryAction = useCallback((): WireClientCommand | null => {
    const cardIds = selectedCards.map(({ id }) => id);
    if (
      actions.has("play-cards") &&
      cardIds.length > 0 &&
      (requiredCardCount === undefined || cardIds.length === requiredCardCount)
    ) {
      // Throws need the explicit two-tap button, never the Enter shortcut.
      if (actions.has("attempt-throw") && selectionKind !== "normal") return null;
      return { type: "PLAY_CARDS", cards: cardIds, intent: "normal" };
    }
    if (actions.has("bury-bottom") && cardIds.length === view.ruleset.bottomSize) {
      return { type: "BURY_BOTTOM", cards: cardIds };
    }
    if (actions.has("bid") && cardIds.length > 0) {
      return { type: "BID", cards: cardIds };
    }
    return null;
  }, [
    actions,
    requiredCardCount,
    selectedCards,
    selectionKind,
    view.ruleset.bottomSize,
  ]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement) return;
      if (event.key === "Escape") {
        clear();
        return;
      }
      if (event.key === "Enter") {
        const command = primaryAction();
        if (command !== null) submit(command);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [primaryAction, submit, clear]);

  const standingTrump = round?.trumpSpec ?? round?.currentBid?.declares;
  const trumpCard: CardInstance | undefined =
    standingTrump?.mode === "suit"
      ? {
          id: `sidebar-trump:${standingTrump.rank}:${standingTrump.suit}`,
          deckIndex: 0,
          face: {
            kind: "standard",
            rank: standingTrump.rank,
            suit: standingTrump.suit,
          },
        }
      : standingTrump?.mode === "no-trump" && round?.currentBid?.face.kind === "joker"
        ? {
            id: `sidebar-trump:joker:${round.currentBid.face.joker}`,
            deckIndex: 0,
            face: round.currentBid.face,
          }
        : undefined;
  const attackerPoints =
    (round?.attackerPoints ?? 0) + (round?.throwPenaltyAdjustment ?? 0);
  const pointsTone =
    attackerPoints < lowToneThreshold
      ? "stat-low"
      : attackerPoints < highToneThreshold
        ? "stat-mid"
        : "stat-high";
  // What the scoreboard would do if the round ended on the current points —
  // shown once cards are actually being played, so the stakes stay visible.
  const projectedOutcome =
    round !== undefined && (view.phase === "playing" || view.phase === "round-scoring")
      ? scoreRound(attackerPoints, resolvedRuleset.scoring)
      : null;
  const pointProgress = Math.max(
    0,
    Math.min(100, (attackerPoints / pointMeterMax) * 100),
  );

  // One timer at a time: the bidding window, then the current turn's clock.
  const timerDeadline =
    view.phase === "dealing" || view.phase === "post-deal-bidding"
      ? round?.biddingDeadline
      : view.phase === "bottom-exchange" ||
          view.phase === "friend-calling" ||
          view.phase === "playing" ||
          view.phase === "round-scoring"
        ? (turnDeadline ?? undefined)
        : undefined;

  // The leader's buried bottom: a pile on the felt that expands on click,
  // plus a sidebar tab with the points tucked away. Leader-only knowledge.
  const buried = view.phase === "playing" ? view.you.buried : undefined;
  const [showBuried, setShowBuried] = useState(false);
  useEffect(() => {
    if (buried === undefined) setShowBuried(false);
  }, [buried === undefined]);

  const youSeat = view.seats.find((seat) => seat.playerId === view.you.playerId);
  const enemySeat = view.seats.find(
    (seat) =>
      seat.teamId !== undefined &&
      view.you.teamId !== undefined &&
      seat.teamId !== view.you.teamId,
  );
  const defendingTeamId = defendingTeamIdForRound(view);
  const yourTeamRole = teamRoleForTeam(view.you.teamId, defendingTeamId);
  const enemyTeamRole = teamRoleForTeam(enemySeat?.teamId, defendingTeamId);
  const previousRound = round?.roundStats.previousRound;
  const previousWinner =
    previousRound === undefined
      ? null
      : outcomeTeamForRound(view, previousRound) === previousRound.winner
        ? "Your team"
        : "Rivals";
  const bidFor = (seatIndex: number) =>
    (view.phase === "dealing" || view.phase === "post-deal-bidding") &&
    round?.currentBid?.seat === seatIndex
      ? round.currentBid
      : undefined;
  const hasPassedBid =
    view.phase === "post-deal-bidding" &&
    view.you.seat !== null &&
    !actions.has("bid") &&
    !actions.has("pass-bid");
  const yourTeamClass = teamClassForTeamId(view.you.teamId);
  const enemyTeamClass = teamClassForTeamId(enemySeat?.teamId);
  const gameVictory =
    view.phase === "game-over" && round?.outcome !== undefined
      ? outcomeTeamForRound({ view, resolved: resolvedRuleset }) ===
        round.outcome.winner
      : false;

  return (
    <main className="game-shell">
      <GameDashboard
        roomId={view.roomId}
        yourTeam={{
          label: "我方 · YOUR TEAM",
          rank: youSeat?.rank ?? null,
          role: yourTeamRole,
          teamClass: yourTeamClass,
        }}
        rivalTeam={{
          label: "对方 · RIVALS",
          rank: enemySeat?.rank ?? null,
          role: enemyTeamRole,
          teamClass: enemyTeamClass,
        }}
        roundNumber={round?.roundNumber ?? 1}
        trumpRank={round?.trumpRank ?? startingRank}
        standingTrump={standingTrump}
        trumpCard={trumpCard}
        attackerPoints={attackerPoints}
        pointsTone={pointsTone}
        pointProgress={pointProgress}
        pointThresholds={pointThresholds}
        pointMeterMax={pointMeterMax}
        projectedOutcome={projectedOutcome}
        previousResult={
          previousRound === undefined || previousWinner === null
            ? null
            : {
                winnerLabel: previousWinner,
                attackerPoints: previousRound.attackerPoints,
                winner: previousRound.winner,
              }
        }
        buriedPoints={buried === undefined ? null : sumCardPoints(buried)}
        bottomOpen={showBuried}
        onToggleBottom={() => setShowBuried((open) => !open)}
        muted={muted}
        onToggleMuted={toggleMuted}
        onLeave={onLeave}
      />

      <section className="board" style={BOARD_ART_STYLE}>
        <MomentLayer moments={moments} dismiss={dismiss} />
        <FxCanvas moments={moments} gameVictory={gameVictory} />
        <AnimatePresence>
          {round?.lastThrow && dismissedThrow !== throwKey && (
            <motion.button
              type="button"
              className={`throw-banner throw-${round.lastThrow.kind}`}
              onClick={() => setDismissedThrow(throwKey)}
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -12 }}
              animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <strong>
                {round.lastThrow.kind === "failed" ? "Throw failed" : "Throw succeeds"}
              </strong>
              <span>{round.lastThrow.explanation}</span>
              {round.lastThrow.pointDeltaToAttackers !== 0 && (
                <b>
                  {round.lastThrow.pointDeltaToAttackers > 0 ? "+" : ""}
                  {round.lastThrow.pointDeltaToAttackers} points
                </b>
              )}
              <i>×</i>
            </motion.button>
          )}
        </AnimatePresence>

        <LayoutGroup>
          <section className="table-stage">
            <div className="felt-table">
              <div className="table-orbit" data-players={playerCount}>
                <img
                  className="table-ring"
                  data-art-asset={ART_ASSET_IDS.tableRing}
                  src={artAssetPath(ART_ASSET_IDS.tableRing)}
                  srcSet={artAssetSrcSet(ART_ASSET_IDS.tableRing)}
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                />
                {view.seats.map((seat) => {
                  if (seat.playerId === view.you.playerId) return null;
                  const legacyPosition =
                    playerCount === 4
                      ? relativeSeatPosition(seat.seat, view.you.seat)
                      : null;
                  const slot =
                    legacyPosition === null
                      ? slots[
                          relativeSeatIndex(seat.seat, view.you.seat ?? 0, playerCount)
                        ]!
                      : null;
                  return (
                    <TableSeat
                      key={seat.seat}
                      seat={seat}
                      position={legacyPosition}
                      slot={slot}
                      currentTurn={round?.currentTurnSeat === seat.seat}
                      trickWinner={trickWinnerSeat === seat.seat}
                      isYou={false}
                      isLeader={round?.leaderSeat === seat.seat}
                      role={teamRoleForSeat(view, seat)}
                      bid={bidFor(seat.seat)}
                      roomId={view.roomId}
                    />
                  );
                })}
                {/* Your tag stays below the ring and above the hand dock. */}
                {youSeat && (
                  <div className="south-cluster">
                    <div className="south-slot south-left">
                      {selected.size > 0 && (
                        <ChromeButton
                          className="table-action-button clear-action-button"
                          variant="neutral"
                          onClick={clear}
                        >
                          Clear
                        </ChromeButton>
                      )}
                    </div>
                    <TableSeat
                      seat={youSeat}
                      position="south"
                      currentTurn={round?.currentTurnSeat === youSeat.seat}
                      trickWinner={trickWinnerSeat === youSeat.seat}
                      isYou
                      isLeader={round?.leaderSeat === youSeat.seat}
                      role={teamRoleForSeat(view, youSeat)}
                      bid={bidFor(youSeat.seat)}
                      roomId={view.roomId}
                      {...(timerDeadline === undefined
                        ? {}
                        : { timer: { deadline: timerDeadline, now: serverNow } })}
                    />
                    <div className="south-slot south-right">
                      <HandActions
                        selectedCards={selectedCards}
                        selectionKind={selectionKind}
                        actions={actions}
                        bottomSize={view.ruleset.bottomSize}
                        hasPassedBid={hasPassedBid}
                        requiredCardCount={requiredCardCount}
                        trump={round?.trumpSpec}
                        submit={submit}
                      />
                    </div>
                  </div>
                )}
                <TrickCenter view={view} />
                {buried && (
                  <button
                    type="button"
                    className="buried-pile"
                    aria-expanded={showBuried}
                    title="Your buried bottom"
                    onClick={() => setShowBuried((open) => !open)}
                  >
                    {Array.from({ length: 3 }, (_, index) => (
                      <CardBack key={index} compact />
                    ))}
                    <span className="card-count">底</span>
                  </button>
                )}
              </div>
              <AnimatePresence>
                {buried && showBuried && (
                  <motion.div
                    className="buried-panel"
                    role="button"
                    tabIndex={0}
                    aria-label="Hide buried bottom"
                    onClick={() => setShowBuried(false)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === "Escape") {
                        setShowBuried(false);
                      }
                    }}
                    {...(reducedMotion
                      ? { initial: false as const }
                      : {
                          initial: { y: 14, scale: 0.92 },
                          animate: { y: 0, scale: 1 },
                          exit: { y: 10, scale: 0.95 },
                        })}
                    transition={
                      reducedMotion
                        ? { duration: 0.18 }
                        : { type: "spring", stiffness: 380, damping: 28 }
                    }
                  >
                    <small>
                      YOUR BOTTOM · {buried.length} cards · {sumCardPoints(buried)} pts
                      (multiplier applies if attackers take the last trick)
                    </small>
                    <div className="buried-panel-cards">
                      {buried.map((card) => (
                        <PlayingCard key={card.id} card={card} compact />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>

          <HandDock
            cards={cards}
            selected={selected}
            hinted={hinted}
            isDealing={view.phase === "dealing"}
            isYourTurn={round?.currentTurnSeat === view.you.seat}
            onToggle={toggle}
          />
        </LayoutGroup>

        <RoundSummaryModal view={view} actions={actions} submit={submit} />
      </section>
    </main>
  );
}
