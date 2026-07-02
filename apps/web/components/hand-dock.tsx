"use client";

import type {
  CardInstance,
  PrivateGameView,
  WireClientCommand,
} from "@shengji/protocol";
import { PlayingCard } from "./card";

export function HandDock({
  cards,
  selected,
  selectedCards,
  onToggle,
  onClear,
  actions,
  bottomSize,
  submit,
}: {
  cards: readonly CardInstance[];
  selected: ReadonlySet<string>;
  selectedCards: readonly CardInstance[];
  onToggle: (card: CardInstance, index: number, shift: boolean) => void;
  onClear: () => void;
  actions: ReadonlySet<PrivateGameView["legalActions"][number]>;
  bottomSize: number;
  submit: (command: WireClientCommand) => void;
}) {
  const selectedIds = selectedCards.map(({ id }) => id);
  return (
    <section className="hand-dock">
      <div className="hand-meta">
        <span>
          YOUR HAND <b>{cards.length}</b>
        </span>
        <span>
          {selected.size} selected
          {selected.size > 0 && (
            <button type="button" className="clear-selection" onClick={onClear}>
              Clear
            </button>
          )}
        </span>
      </div>
      <div className="hand-scroll" role="group" aria-label="Your hand">
        {cards.map((card, index) => (
          <PlayingCard
            key={card.id}
            card={card}
            entrance="deal"
            selected={selected.has(card.id)}
            onSelect={(event) => onToggle(card, index, event.shiftKey)}
          />
        ))}
      </div>

      <div className="action-dock">
        {actions.has("pass-bid") && (
          <button
            className="button button-ghost"
            type="button"
            onClick={() => submit({ type: "PASS_BID" })}
          >
            Pass
          </button>
        )}
        {actions.has("bid") && (
          <button
            className="button button-gold"
            type="button"
            disabled={selectedIds.length === 0}
            onClick={() => submit({ type: "BID", cards: selectedIds })}
          >
            Bid selected
          </button>
        )}
        {actions.has("bury-bottom") && (
          <button
            className="button button-primary"
            type="button"
            disabled={selectedIds.length !== bottomSize}
            onClick={() => submit({ type: "BURY_BOTTOM", cards: selectedIds })}
          >
            Bury {selectedIds.length} / {bottomSize}
          </button>
        )}
        {actions.has("attempt-throw") && (
          <button
            className="button button-ghost"
            type="button"
            disabled={selectedIds.length < 2}
            onClick={() =>
              submit({ type: "PLAY_CARDS", cards: selectedIds, intent: "throw" })
            }
          >
            Throw / 甩牌
          </button>
        )}
        {actions.has("play-cards") && (
          <button
            className="button button-primary"
            type="button"
            disabled={selectedIds.length === 0}
            onClick={() =>
              submit({ type: "PLAY_CARDS", cards: selectedIds, intent: "normal" })
            }
          >
            Play selected
          </button>
        )}
      </div>
    </section>
  );
}
