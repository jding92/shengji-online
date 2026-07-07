"use client";

import type {
  CardInstance,
  PrivateGameView,
  WireClientCommand,
} from "@shengji/protocol";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  canHandOutbid,
  cardFaceKey,
  fourPlayerTwoDeckFixedTeamRuleset,
  getEffectiveSuit,
  parseThrow,
  parseTrickFormat,
  scoreRound,
  sumCardPoints,
} from "@shengji/engine";
import { useCardSelection } from "../hooks/use-card-selection";
import { useGameMoments } from "../hooks/use-game-moments";
import { ART, art2x } from "../lib/art";
import { THROW_BANNER_MS, TRICK_WINNER_GLOW_MS } from "../lib/constants";
import { compareForHandDisplay, relativeSeatPosition } from "../lib/cards";
import { teamClassForSeat } from "../lib/strings";
import { CardBack, PlayingCard } from "./card";
import { HandActions } from "./hand-actions";
import { HandDock } from "./hand-dock";
import { LeaveButton } from "./leave-button";
import { MomentLayer } from "./moment-layer";
import { RoundSummaryModal } from "./round-summary-modal";
import { TableSeat } from "./table-seat";
import { TrickCenter } from "./trick-center";

type GameTableProps = {
  view: PrivateGameView;
  sendCommand: (command: WireClientCommand) => boolean;
  onLeave: () => void;
  turnDeadline: string | null;
  serverNow: () => number;
};

type TeamRole = "attacking" | "defending" | "pending";

/**
 * Team-role badge: the Chinese character carries the meaning (攻 attack,
 * 守 defend), the icon and small English caption back it up.
 */
function TeamRoleBadge({ role }: { role: TeamRole }) {
  if (role === "pending") {
    return (
      <>
        <span className="role-char">待</span>
        <span className="role-en">PENDING</span>
      </>
    );
  }
  return (
    <>
      <img
        className="role-medallion"
        src={role === "attacking" ? ART.ui.attackBadge : ART.ui.defendBadge}
        srcSet={`${art2x(role === "attacking" ? ART.ui.attackBadge : ART.ui.defendBadge)} 2x`}
        alt=""
        aria-hidden="true"
      />
      <span className="role-char">{role === "attacking" ? "攻" : "守"}</span>
      <span className="role-en">{role === "attacking" ? "ATTACK" : "DEFEND"}</span>
    </>
  );
}

export function GameTable({
  view,
  sendCommand,
  onLeave,
  turnDeadline,
  serverNow,
}: GameTableProps) {
  const round = view.publicRound;
  const { moments, dismiss } = useGameMoments(view);
  const actions = useMemo(() => new Set(view.legalActions), [view.legalActions]);
  // Sort trump-aware: before a suit is declared, treat the level rank as
  // no-trump so level cards group with the jokers instead of their suits.
  const cards = useMemo(() => {
    const trump = round?.trumpSpec ?? {
      mode: "no-trump" as const,
      rank: round?.trumpRank ?? "2",
    };
    return [...view.you.hand].sort((a, b) => compareForHandDisplay(a, b, trump));
  }, [view.you.hand, round?.trumpSpec, round?.trumpRank]);

  // Steady-state hand size = (all dealt cards − the buried bottom) ÷ players.
  // A standard deck here is 54 cards (52 + two jokers).
  const fullHandSize = Math.round(
    (view.ruleset.decks * 54 - view.ruleset.bottomSize) / view.ruleset.players,
  );
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
    (command: WireClientCommand) => {
      if (sendCommand(command)) clear();
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
        rules: fourPlayerTwoDeckFixedTeamRuleset.bidding,
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
    attackerPoints < 80 ? "stat-low" : attackerPoints < 120 ? "stat-mid" : "stat-high";
  // What the scoreboard would do if the round ended on the current points —
  // shown once cards are actually being played, so the stakes stay visible.
  const projectedOutcome =
    round !== undefined && (view.phase === "playing" || view.phase === "round-scoring")
      ? scoreRound(attackerPoints, fourPlayerTwoDeckFixedTeamRuleset.scoring)
      : null;

  // One timer at a time: the bidding window, then the current turn's clock.
  const timerDeadline =
    view.phase === "dealing" || view.phase === "post-deal-bidding"
      ? round?.biddingDeadline
      : view.phase === "bottom-exchange" ||
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
  const defendingSeatIndex = round?.leaderSeat ?? round?.currentBid?.seat;
  const defendingTeamId =
    defendingSeatIndex === undefined
      ? undefined
      : view.seats.find((seat) => seat.seat === defendingSeatIndex)?.teamId;
  const yourTeamRole =
    defendingTeamId === undefined || view.you.teamId === undefined
      ? "pending"
      : defendingTeamId === view.you.teamId
        ? "defending"
        : "attacking";
  const enemyTeamRole =
    defendingTeamId === undefined || enemySeat?.teamId === undefined
      ? "pending"
      : defendingTeamId === enemySeat.teamId
        ? "defending"
        : "attacking";
  const previousRound = round?.roundStats.previousRound;
  const previousWinner =
    previousRound === undefined
      ? null
      : previousRound.winningTeamId === view.you.teamId
        ? "Your team"
        : "Rivals";
  const yourRoundsWon =
    view.you.teamId === undefined
      ? 0
      : (round?.roundStats.roundsWonByTeam[view.you.teamId] ?? 0);
  const rivalRoundsWon =
    enemySeat?.teamId === undefined
      ? 0
      : (round?.roundStats.roundsWonByTeam[enemySeat.teamId] ?? 0);
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
  const yourTeamClass = youSeat === undefined ? "" : teamClassForSeat(youSeat.seat);
  const enemyTeamClass =
    enemySeat === undefined ? "" : teamClassForSeat(enemySeat.seat);
  const roleForSeat = (
    seat: PrivateGameView["seats"][number],
  ): "attacking" | "defending" | null =>
    defendingTeamId === undefined || seat.teamId === undefined
      ? null
      : seat.teamId === defendingTeamId
        ? "defending"
        : "attacking";

  return (
    <main className="game-shell">
      <aside className="side-panel">
        <div className="brand-lockup">
          <span className="brand-mark">升</span>
          <span>
            <strong>Sheng Ji</strong>
            <small>Room {view.roomId}</small>
          </span>
        </div>

        {/* The round panel is a two-column grid with full-width hero rows. */}
        <div className="round-pills">
          <div className="team-score-pills">
            <span className={`team-score-pill ${yourTeamClass} is-${yourTeamRole}`}>
              <small>我方 · YOUR TEAM</small>
              <strong>{youSeat?.rank ?? "—"}</strong>
              <em aria-label={yourTeamRole}>
                <TeamRoleBadge role={yourTeamRole} />
              </em>
            </span>
            <span className={`team-score-pill ${enemyTeamClass} is-${enemyTeamRole}`}>
              <small>对方 · RIVALS</small>
              <strong>{enemySeat?.rank ?? "—"}</strong>
              <em aria-label={enemyTeamRole}>
                <TeamRoleBadge role={enemyTeamRole} />
              </em>
            </span>
          </div>
          <div className="round-overview-row">
            <span className="game-stats-pill">
              <small>对局 · GAME STATS</small>
              <span className="current-round-stat">
                <i>ROUND</i>
                <strong>{round?.roundNumber ?? 1}</strong>
              </span>
              <span className="previous-round-stat">
                <i>PREVIOUS</i>
                <strong>{previousWinner ?? "No result"}</strong>
                <b>
                  {previousRound === undefined
                    ? "—"
                    : `${previousRound.attackerPoints} pts · ${previousRound.winner}`}
                </b>
              </span>
              <span className="round-wins-stat">
                <i>ROUNDS WON</i>
                <b>YOU {yourRoundsWon}</b>
                <b>RIVALS {rivalRoundsWon}</b>
              </span>
            </span>
            <span
              className="level-trump-pill"
              aria-label={
                standingTrump === undefined
                  ? `Level ${round?.trumpRank ?? "2"}, trump undeclared`
                  : standingTrump.mode === "no-trump"
                    ? "No-trump"
                    : `${standingTrump.rank} of ${standingTrump.suit} is trump`
              }
            >
              <small className="trump-panel-label">主牌 · ROUND TRUMP</small>
              {trumpCard !== undefined ? (
                <PlayingCard
                  card={trumpCard}
                  {...(standingTrump === undefined ? {} : { trump: standingTrump })}
                />
              ) : standingTrump?.mode === "no-trump" ? (
                <span className="generic-joker-card" aria-hidden="true">
                  王
                </span>
              ) : (
                <span className="pending-trump-card" aria-hidden="true">
                  <strong>{round?.trumpRank ?? "2"}</strong>
                  <b>?</b>
                </span>
              )}
            </span>
          </div>
          <span className="points-pill">
            <small>分 · POINTS</small>
            <strong className={pointsTone}>{attackerPoints}</strong>
            {projectedOutcome && (
              <em
                className={`points-projection is-${projectedOutcome.winner}`}
                title="Outcome if the round ended at the current points"
              >
                {projectedOutcome.winner === "attackers" ? "攻" : "守"}
                {projectedOutcome.levelDelta > 0
                  ? ` +${projectedOutcome.levelDelta}`
                  : " 夺庄"}
                <i>IF ENDED NOW</i>
              </em>
            )}
          </span>
          {buried && (
            <button
              type="button"
              className={`bottom-tab ${showBuried ? "is-open" : ""}`}
              onClick={() => setShowBuried((open) => !open)}
            >
              <img
                className="bottom-tab-icon"
                src={ART.ui.buriedCards}
                srcSet={`${art2x(ART.ui.buriedCards)} 2x`}
                alt=""
                aria-hidden="true"
              />
              <small>底牌 · BOTTOM</small>
              <strong>{sumCardPoints(buried)} pts</strong>
            </button>
          )}
        </div>

        <div className="side-actions">
          <LeaveButton onLeave={onLeave} />
        </div>
      </aside>

      <section className="board">
        <MomentLayer moments={moments} dismiss={dismiss} />
        <AnimatePresence>
          {round?.lastThrow && dismissedThrow !== throwKey && (
            <motion.button
              type="button"
              className={`throw-banner throw-${round.lastThrow.kind}`}
              onClick={() => setDismissedThrow(throwKey)}
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
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
              {view.seats.map((seat) =>
                seat.playerId === view.you.playerId ? null : (
                  <TableSeat
                    key={seat.seat}
                    seat={seat}
                    position={relativeSeatPosition(seat.seat, view.you.seat)}
                    currentTurn={round?.currentTurnSeat === seat.seat}
                    trickWinner={trickWinnerSeat === seat.seat}
                    isYou={false}
                    isLeader={round?.leaderSeat === seat.seat}
                    role={roleForSeat(seat)}
                    bid={bidFor(seat.seat)}
                    roomId={view.roomId}
                  />
                ),
              )}
              {/* Your seat sits on a row with the action buttons flanking it:
                  Clear to the left, the primary action to the right. */}
              {youSeat && (
                <div className="south-cluster">
                  <div className="south-slot south-left">
                    {selected.size > 0 && (
                      <button
                        type="button"
                        className="button button-ghost"
                        onClick={clear}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <TableSeat
                    seat={youSeat}
                    position="south"
                    currentTurn={round?.currentTurnSeat === youSeat.seat}
                    trickWinner={trickWinnerSeat === youSeat.seat}
                    isYou
                    isLeader={round?.leaderSeat === youSeat.seat}
                    role={roleForSeat(youSeat)}
                    handTotal={fullHandSize}
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
                    initial={{ opacity: 0, y: 14, scale: 0.92 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 380, damping: 28 }}
                  >
                    <small>
                      YOUR BOTTOM · {buried.length} cards · {sumCardPoints(buried)} pts
                      (multiplier applies if attackers take the last trick)
                    </small>
                    <div className="buried-panel-cards">
                      {buried.map((card) => (
                        <PlayingCard
                          key={card.id}
                          card={card}
                          compact
                          {...(round?.trumpSpec === undefined
                            ? {}
                            : { trump: round.trumpSpec })}
                        />
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
            trump={round?.trumpSpec}
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
