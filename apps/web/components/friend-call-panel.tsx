"use client";

import type { PrivateGameView, WireClientCommand } from "@shengji/protocol";
import { RANKS, SUITS, type Rank, type Suit, type TrumpSpec } from "@shengji/engine";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  callOptions,
  ordinalLabel,
  validateCalls,
  type FriendCallInput,
} from "../lib/friend-calls";
import { suitGlyph } from "../lib/cards";
import { resolveViewRuleset } from "../lib/rules";
import { Countdown } from "./countdown";
import { ChromeButton, ChromePanel } from "./ui-chrome";

type DraftCall = {
  suit: Suit | null;
  rank: Rank | null;
  copyIndex: number | null;
};

type FriendCallPanelProps = {
  view: PrivateGameView;
  sendTrackedCommand: (command: WireClientCommand) => string | null;
  trackedRejections: ReadonlyMap<string, { code: string; message: string }>;
  consumeRejection: (
    requestId: string,
  ) => { code: string; message: string } | undefined;
  turnDeadline: string | null;
  serverNow: () => number;
};

const SUIT_LABELS: Record<Suit, string> = {
  spades: "Spades · 黑桃",
  hearts: "Hearts · 红桃",
  clubs: "Clubs · 梅花",
  diamonds: "Diamonds · 方块",
};

function emptyDraft(): DraftCall {
  return { suit: null, rank: null, copyIndex: null };
}

function toInput(draft: DraftCall): FriendCallInput {
  return {
    face:
      draft.suit === null || draft.rank === null
        ? null
        : { kind: "standard", suit: draft.suit, rank: draft.rank },
    copyIndex: draft.copyIndex,
  };
}

export function FriendCallPanel({
  view,
  sendTrackedCommand,
  trackedRejections,
  consumeRejection,
  turnDeadline,
  serverNow,
}: FriendCallPanelProps) {
  const round = view.publicRound;
  const resolved = resolveViewRuleset(view.ruleset);
  if (resolved.teams.mode !== "finding-friends" || round === undefined) return null;

  const callCount = resolved.teams.friends.callCount;
  const trumpSpec = round.trumpSpec;
  if (trumpSpec === undefined) return null;

  return (
    <FriendCallPanelForm
      callCount={callCount}
      deckCount={resolved.decks.count}
      trumpRank={round.trumpRank}
      trumpSpec={trumpSpec}
      sendTrackedCommand={sendTrackedCommand}
      trackedRejections={trackedRejections}
      consumeRejection={consumeRejection}
      turnDeadline={turnDeadline}
      serverNow={serverNow}
    />
  );
}

function FriendCallPanelForm({
  callCount,
  deckCount,
  trumpRank,
  trumpSpec,
  sendTrackedCommand,
  trackedRejections,
  consumeRejection,
  turnDeadline,
  serverNow,
}: {
  callCount: number;
  deckCount: number;
  trumpRank: Rank;
  trumpSpec: TrumpSpec;
  sendTrackedCommand: (command: WireClientCommand) => string | null;
  trackedRejections: ReadonlyMap<string, { code: string; message: string }>;
  consumeRejection: (
    requestId: string,
  ) => { code: string; message: string } | undefined;
  turnDeadline: string | null;
  serverNow: () => number;
}) {
  const options = useMemo(
    () => callOptions({ callCount, deckCount, trumpRank, trumpSpec }),
    [callCount, deckCount, trumpRank, trumpSpec],
  );
  const [drafts, setDrafts] = useState<DraftCall[]>(() =>
    Array.from({ length: callCount }, emptyDraft),
  );
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [rejection, setRejection] = useState<string | null>(null);

  useEffect(() => {
    setDrafts((current) =>
      current.length === callCount
        ? current
        : Array.from(
            { length: callCount },
            (_, index) => current[index] ?? emptyDraft(),
          ),
    );
  }, [callCount]);

  const validation = useMemo(
    () =>
      validateCalls(drafts.map(toInput), {
        callCount,
        deckCount,
        trumpRank,
        trumpSpec,
      }),
    [callCount, deckCount, drafts, trumpRank, trumpSpec],
  );

  useEffect(() => {
    if (pendingRequestId === null || !trackedRejections.has(pendingRequestId)) return;
    const nextRejection = consumeRejection(pendingRequestId);
    if (nextRejection === undefined) return;
    setRejection(nextRejection.message);
    setPendingRequestId(null);
  }, [consumeRejection, pendingRequestId, trackedRejections]);

  function updateDraft(index: number, patch: Partial<DraftCall>): void {
    setDrafts((current) =>
      current.map((draft, draftIndex) =>
        draftIndex === index ? { ...draft, ...patch } : draft,
      ),
    );
    setRejection(null);
  }

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!validation.valid || pendingRequestId !== null) return;
    const calls = drafts.map((draft) => ({
      face: { kind: "standard" as const, suit: draft.suit!, rank: draft.rank! },
      copyIndex: draft.copyIndex!,
    }));
    const requestId = sendTrackedCommand({ type: "CALL_FRIENDS", calls });
    if (requestId !== null) setPendingRequestId(requestId);
  }

  return (
    <ChromePanel className="friend-call-panel" role="dialog" aria-label="Call friends">
      <form onSubmit={submit}>
        <div className="friend-call-heading">
          <div>
            <p className="eyebrow">CALL FRIENDS · 叫朋友</p>
            <h2>
              Choose {callCount} call{callCount === 1 ? "" : "s"}
            </h2>
            <small>
              Announce the card and which copy should answer · 选择牌面和副数
            </small>
          </div>
          <span className="friend-call-countdown" aria-live="polite">
            <strong>AUTO-CALL IN</strong>
            {turnDeadline === null ? (
              <span className="friend-call-countdown-placeholder">…</span>
            ) : (
              <Countdown deadline={turnDeadline} now={serverNow} />
            )}
            <small>· 自动叫牌</small>
          </span>
        </div>

        <div className="friend-call-rows">
          {drafts.map((draft, index) => {
            const rowValidation = validation.perCall[index];
            return (
              <fieldset
                className={`friend-call-row${rowValidation?.valid === false ? " has-error" : ""}`}
                key={index}
              >
                <legend>
                  CALL {index + 1} · 叫牌 {index + 1}
                </legend>
                <div className="friend-call-option-group">
                  <span className="friend-call-option-label">SUIT · 花色</span>
                  <div className="friend-call-options friend-call-suit-options">
                    {SUITS.map((suit) => {
                      const disabled = !options.suits.includes(suit);
                      return (
                        <ChromeButton
                          className="friend-call-option friend-call-suit-option"
                          key={suit}
                          variant={draft.suit === suit ? "gold" : "neutral"}
                          aria-pressed={draft.suit === suit}
                          aria-label={SUIT_LABELS[suit]}
                          title={
                            disabled
                              ? "Trump suit cannot be called · 王牌花色不能叫"
                              : SUIT_LABELS[suit]
                          }
                          disabled={disabled}
                          onClick={() => updateDraft(index, { suit })}
                        >
                          {suitGlyph(suit)}
                        </ChromeButton>
                      );
                    })}
                  </div>
                </div>

                <div className="friend-call-option-group">
                  <span className="friend-call-option-label">RANK · 点数</span>
                  <div className="friend-call-options friend-call-rank-options">
                    {RANKS.map((rank) => {
                      const disabled = !options.ranks.includes(rank);
                      return (
                        <ChromeButton
                          className="friend-call-option friend-call-rank-option"
                          key={rank}
                          variant={draft.rank === rank ? "gold" : "neutral"}
                          aria-pressed={draft.rank === rank}
                          aria-label={
                            disabled
                              ? `${rank}, level rank cannot be called · 级牌不能叫`
                              : rank
                          }
                          title={
                            disabled ? "Level rank cannot be called · 级牌不能叫" : rank
                          }
                          disabled={disabled}
                          onClick={() => updateDraft(index, { rank })}
                        >
                          {rank}
                        </ChromeButton>
                      );
                    })}
                  </div>
                </div>

                <div className="friend-call-option-group">
                  <span className="friend-call-option-label">COPY · 副数</span>
                  <div className="friend-call-options friend-call-copy-options">
                    {options.copyIndices.map((copyIndex) => (
                      <ChromeButton
                        className="friend-call-option friend-call-copy-option"
                        key={copyIndex}
                        variant={draft.copyIndex === copyIndex ? "gold" : "neutral"}
                        aria-pressed={draft.copyIndex === copyIndex}
                        onClick={() => updateDraft(index, { copyIndex })}
                      >
                        {ordinalLabel(copyIndex)} · 第{copyIndex}张
                      </ChromeButton>
                    ))}
                  </div>
                </div>

                {rowValidation !== undefined && rowValidation.errors.length > 0 && (
                  <small className="friend-call-row-error" role="alert">
                    {rowValidation.errors[0]}
                  </small>
                )}
              </fieldset>
            );
          })}
        </div>

        {validation.errors.length > 0 && (
          <small className="friend-call-validation-error" role="status">
            {validation.errors[0]}
          </small>
        )}
        {rejection !== null && (
          <small className="friend-call-rejection" role="alert">
            {rejection}
          </small>
        )}
        <ChromeButton
          className="friend-call-submit"
          type="submit"
          variant="primary"
          disabled={!validation.valid || pendingRequestId !== null}
        >
          {pendingRequestId === null ? "Call friends · 叫朋友" : "Calling… · 叫牌中"}
        </ChromeButton>
      </form>
    </ChromePanel>
  );
}
