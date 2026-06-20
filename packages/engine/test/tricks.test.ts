import { describe, expect, it } from "vitest";
import {
  PlayValidationError,
  createDeck,
  determineTrickWinner,
  parseThrow,
  parseTrickFormat,
  validateFollow,
  validateLead,
  type CardInstance,
  type Rank,
  type Suit,
  type TrumpSpec,
} from "../src/index.js";

const deck = createDeck(2);
const suitTrump: TrumpSpec = { mode: "suit", rank: "3", suit: "hearts" };

function cards(suit: Suit, rank: Rank): CardInstance[] {
  return deck.filter(
    (card) =>
      card.face.kind === "standard" &&
      card.face.suit === suit &&
      card.face.rank === rank,
  );
}

function one(suit: Suit, rank: Rank, deckIndex = 0): CardInstance {
  return cards(suit, rank).find((card) => card.deckIndex === deckIndex)!;
}

function expectPlayError(run: () => unknown, code: PlayValidationError["code"]): void {
  try {
    run();
    expect.fail("Expected play validation to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(PlayValidationError);
    expect((error as PlayValidationError).code).toBe(code);
  }
}

describe("trick format parsing", () => {
  it("parses singles and identical tuples", () => {
    expect(parseTrickFormat(cards("clubs", "8").slice(0, 1), suitTrump).kind).toBe(
      "single",
    );
    const pair = parseTrickFormat(cards("clubs", "8"), suitTrump);
    expect(pair.kind).toBe("tuple");
    expect(pair.components[0]).toMatchObject({ kind: "tuple", tupleSize: 2 });
  });

  it("parses 2244 as a tractor when 3 is the level rank", () => {
    const format = parseTrickFormat(
      [...cards("clubs", "2"), ...cards("clubs", "4")],
      suitTrump,
    );
    expect(format.kind).toBe("tractor");
    expect(format.components[0]).toMatchObject({
      kind: "tractor",
      tupleSize: 2,
      runLength: 2,
    });
  });

  it.each([
    [
      "secondary and primary level pairs",
      () => [...cards("clubs", "3"), ...cards("hearts", "3")],
    ],
    [
      "primary level and small-joker pairs",
      () => [
        ...cards("hearts", "3"),
        ...deck.filter(
          (card) => card.face.kind === "joker" && card.face.joker === "small",
        ),
      ],
    ],
    [
      "small- and big-joker pairs",
      () => deck.filter((card) => card.face.kind === "joker"),
    ],
  ])("parses required trump tractor: %s", (_name, makeCards) => {
    expect(parseTrickFormat(makeCards(), suitTrump).kind).toBe("tractor");
  });

  it("prefers a tractor as the longest throw component", () => {
    const format = parseThrow(
      [...cards("spades", "K"), ...cards("spades", "A"), one("spades", "9")],
      suitTrump,
    );
    expect(format.kind).toBe("throw");
    expect(format.components).toHaveLength(2);
    expect(format.components[0]).toMatchObject({
      kind: "tractor",
      tupleSize: 2,
      runLength: 2,
    });
  });
});

describe("follow-play legality", () => {
  it("requires the led suit before allowing discards", () => {
    const led = parseTrickFormat(cards("clubs", "8"), suitTrump);
    const hand = [one("clubs", "4"), one("clubs", "5"), one("spades", "A")];
    expectPlayError(
      () =>
        validateFollow({
          cards: [one("clubs", "4"), one("spades", "A")],
          hand,
          ledFormat: led,
          trump: suitTrump,
        }),
      "MUST_FOLLOW_SUIT",
    );
  });

  it("requires a pair when the hand can match a led pair", () => {
    const led = parseTrickFormat(cards("clubs", "8"), suitTrump);
    const hand = [...cards("clubs", "A"), one("clubs", "K")];
    expectPlayError(
      () =>
        validateFollow({
          cards: [one("clubs", "A"), one("clubs", "K")],
          hand,
          ledFormat: led,
          trump: suitTrump,
        }),
      "MUST_MATCH_FORMAT",
    );
    expect(
      validateFollow({
        cards: cards("clubs", "A"),
        hand,
        ledFormat: led,
        trump: suitTrump,
      }).eligibleToWin,
    ).toBe(true);
  });

  it("requires a tractor before disconnected pairs or loose cards", () => {
    const led = parseTrickFormat(
      [...cards("clubs", "2"), ...cards("clubs", "4")],
      suitTrump,
    );
    const hand = [
      ...cards("clubs", "5"),
      ...cards("clubs", "6"),
      one("clubs", "9"),
      one("clubs", "10"),
    ];
    expectPlayError(
      () =>
        validateFollow({
          cards: [...cards("clubs", "5"), one("clubs", "9"), one("clubs", "10")],
          hand,
          ledFormat: led,
          trump: suitTrump,
        }),
      "MUST_MATCH_FORMAT",
    );
    expect(
      validateFollow({
        cards: [...cards("clubs", "5"), ...cards("clubs", "6")],
        hand,
        ledFormat: led,
        trump: suitTrump,
      }).eligibleToWin,
    ).toBe(true);
  });

  it("allows an exact trump ruff only when void in the led suit", () => {
    const led = parseTrickFormat(cards("clubs", "8"), suitTrump);
    const hand = [...cards("hearts", "9"), one("spades", "A")];
    const play = validateFollow({
      cards: cards("hearts", "9"),
      hand,
      ledFormat: led,
      trump: suitTrump,
    });
    expect(play.eligibleToWin).toBe(true);
  });

  it("marks a structurally incomplete follow as unable to win", () => {
    const led = parseTrickFormat(cards("clubs", "8"), suitTrump);
    const hand = [one("clubs", "A"), one("spades", "A")];
    const play = validateFollow({
      cards: hand,
      hand,
      ledFormat: led,
      trump: suitTrump,
    });
    expect(play.eligibleToWin).toBe(false);
  });
});

describe("trick winner", () => {
  it("lets an exact trump ruff beat the led suit and totals trick points", () => {
    const leadCards = cards("clubs", "10");
    const ledFormat = parseTrickFormat(leadCards, suitTrump);
    const lead = validateLead({
      cards: leadCards,
      hand: leadCards,
      trump: suitTrump,
      intent: "normal",
      throwsEnabled: true,
    });
    const trumpHand = cards("hearts", "5");
    const ruff = validateFollow({
      cards: trumpHand,
      hand: trumpHand,
      ledFormat,
      trump: suitTrump,
    });
    const winner = determineTrickWinner(
      [
        { seat: 0, ...lead },
        { seat: 1, ...ruff },
      ],
      suitTrump,
    );
    expect(winner.winnerSeat).toBe(1);
    expect(winner.points).toBe(30);
  });
});
