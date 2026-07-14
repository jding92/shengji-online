import { expect, test } from "@playwright/test";
import {
  clickCard,
  closePlayers,
  joinPlayers,
  playButton,
  type Player,
  readyPlayers,
} from "./helpers";

test("four players join, bid, bury, and complete a legal trick", async ({
  browser,
  request,
}) => {
  const created = await request.post("/api/rooms", { data: {} });
  expect(created.ok()).toBe(true);
  const roomId = ((await created.json()) as { room: { roomId: string } }).room.roomId;
  const players: Player[] = await joinPlayers(browser, roomId, 4);

  try {
    await readyPlayers(players);
    for (const { page } of players) {
      await expect(page.locator(".hand-scroll .playing-card")).toHaveCount(25, {
        timeout: 30_000,
      });
      // Generous: under full-suite load the shared dev server runs several bot
      // games at once, so the deal→bidding transition can lag.
      await expect(page.getByText("Declare trump")).toBeVisible({ timeout: 20_000 });
    }
    await players[3]!.page.reload();
    await expect(players[3]!.page.locator(".hand-scroll .playing-card")).toHaveCount(
      25,
      { timeout: 30_000 },
    );
    await expect(players[3]!.page.getByText("Declare trump")).toBeVisible({
      timeout: 20_000,
    });

    let bidderSeat = -1;
    let bidLabel = "";
    for (let seat = 0; seat < players.length; seat += 1) {
      const twos = players[seat]!.page.locator(
        '.hand-scroll .playing-card[aria-label^="2 of"]',
      );
      if ((await twos.count()) > 0) {
        bidderSeat = seat;
        bidLabel = (await twos.first().getAttribute("aria-label"))!;
        await clickCard(twos.first());
        await players[seat]!.page.getByRole("button", { name: "Bid selected" }).click();
        break;
      }
    }
    expect(bidderSeat).toBeGreaterThanOrEqual(0);
    const bidder = players[bidderSeat]!;
    await expect(bidder.page.getByText("Bury 0 / 8")).toBeVisible({ timeout: 8_000 });
    await expect(bidder.page.locator(".hand-scroll .playing-card")).toHaveCount(33);

    const bidderCards = bidder.page.locator(".hand-scroll .playing-card");
    for (let index = 0; index < 8; index += 1) {
      await clickCard(bidderCards.nth(index));
    }
    await bidder.page.getByRole("button", { name: "Bury 8 / 8" }).click();
    await expect(playButton(bidder.page)).toBeVisible();

    const trumpSuit = bidLabel.split(" of ")[1]!;
    const leadCards = bidder.page.locator(".hand-scroll .playing-card");
    let leadIndex = -1;
    let leadSuit = "";
    for (let index = 0; index < (await leadCards.count()); index += 1) {
      const label = (await leadCards.nth(index).getAttribute("aria-label"))!;
      const [rank, suit] = label.split(" of ");
      if (suit !== undefined && suit !== trumpSuit && rank !== "2") {
        leadIndex = index;
        leadSuit = suit;
        break;
      }
    }
    expect(leadIndex).toBeGreaterThanOrEqual(0);
    await clickCard(leadCards.nth(leadIndex));
    await playButton(bidder.page).click();

    for (let offset = 1; offset < 4; offset += 1) {
      const seat = (bidderSeat + offset) % 4;
      const page = players[seat]!.page;
      await expect(playButton(page)).toBeVisible();
      const hand = page.locator(".hand-scroll .playing-card");
      let choice = 0;
      for (let index = 0; index < (await hand.count()); index += 1) {
        const label = (await hand.nth(index).getAttribute("aria-label"))!;
        const [rank, suit] = label.split(" of ");
        if (suit === leadSuit && rank !== "2") {
          choice = index;
          break;
        }
      }
      await clickCard(hand.nth(choice));
      await playButton(page).click();
    }

    const finalPlayerPage = players[(bidderSeat + 3) % 4]!.page;
    await expect(finalPlayerPage.locator(".trick-sweep .center-play")).toHaveCount(4);
    for (const position of ["south", "east", "north", "west"]) {
      await expect(
        finalPlayerPage.locator(`.trick-sweep .play-${position}`),
      ).toHaveCount(1);
    }
    await finalPlayerPage.waitForTimeout(2_500);
    await expect(finalPlayerPage.locator(".trick-sweep .center-play")).toHaveCount(4);

    for (const { page } of players) {
      await expect(page.locator(".hand-scroll .playing-card")).toHaveCount(24);
    }
  } finally {
    await closePlayers(players);
  }
});
