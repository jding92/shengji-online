import { expect, test } from "@playwright/test";
import {
  cardLabelParts,
  clickCard,
  closePlayers,
  createRoom,
  joinPlayers,
  playLowestSingle,
  playButton,
  type Player,
  readyPlayers,
} from "./helpers";

test("six players complete one legal trick", async ({ browser, request }) => {
  const roomId = await createRoom(request, {
    presetId: "shengji-6p-3d-fixed-v1",
  });
  const players: Player[] = await joinPlayers(browser, roomId, 6);

  try {
    await readyPlayers(players);
    for (const { page } of players) {
      await expect(page.locator(".hand-scroll .playing-card")).not.toHaveCount(0, {
        timeout: 30_000,
      });
      // Generous: under full-suite load the shared dev server runs several bot
      // games at once, so the deal→bidding transition can lag.
      await expect(page.getByText("Declare trump")).toBeVisible({ timeout: 20_000 });
    }

    // The deal determines the hand size for this preset; retain that observed
    // value instead of baking the 3-deck arithmetic into the browser test.
    const dealtHandSize = await players[0]!.page
      .locator(".hand-scroll .playing-card")
      .count();
    expect(dealtHandSize).toBeGreaterThan(0);
    for (const { page } of players) {
      await expect(page.locator(".hand-scroll .playing-card")).toHaveCount(
        dealtHandSize,
      );
    }

    let bidderSeat = -1;
    let bidLabel = "";
    for (let seat = 0; seat < players.length; seat += 1) {
      const twos = players[seat]!.page.locator(
        '.hand-scroll .playing-card[aria-label^="2 of"]',
      );
      if ((await twos.count()) === 0) continue;
      bidderSeat = seat;
      bidLabel = (await twos.first().getAttribute("aria-label"))!;
      await clickCard(twos.first());
      await players[seat]!.page.getByRole("button", { name: "Bid selected" }).click();
      break;
    }
    expect(bidderSeat).toBeGreaterThanOrEqual(0);

    const bidder = players[bidderSeat]!;
    const buryButton = bidder.page.getByRole("button", { name: /^Bury 0 \/ / });
    await expect(buryButton).toBeVisible({ timeout: 8_000 });
    const buryCopy = await buryButton.textContent();
    const bottomSize = Number(buryCopy?.match(/\/ (\d+)/)?.[1]);
    expect(bottomSize).toBeGreaterThan(0);
    const bidderCards = bidder.page.locator(".hand-scroll .playing-card");
    for (let index = 0; index < bottomSize; index += 1) {
      await clickCard(bidderCards.nth(index));
    }
    await bidder.page
      .getByRole("button", { name: `Bury ${bottomSize} / ${bottomSize}` })
      .click();
    await expect(playButton(bidder.page)).toBeVisible();
    await expect(bidder.page.locator(".table-orbit > .table-seat")).toHaveCount(5);

    const trumpSuit = cardLabelParts(bidLabel).suit;
    const leadCards = bidder.page.locator(".hand-scroll .playing-card");
    let leadIndex = -1;
    let leadSuit: string | undefined;
    for (let index = 0; index < (await leadCards.count()); index += 1) {
      const label = (await leadCards.nth(index).getAttribute("aria-label")) ?? "";
      const parts = cardLabelParts(label);
      if (parts.suit !== undefined && parts.suit !== trumpSuit && parts.rank !== "2") {
        leadIndex = index;
        leadSuit = parts.suit;
        break;
      }
    }
    expect(leadIndex).toBeGreaterThanOrEqual(0);
    await clickCard(leadCards.nth(leadIndex));
    await playButton(bidder.page).click();

    for (let offset = 1; offset < players.length; offset += 1) {
      const page = players[(bidderSeat + offset) % players.length]!.page;
      await expect(playButton(page)).toBeVisible();
      await playLowestSingle(page, leadSuit);
    }

    const finalPlayerPage =
      players[(bidderSeat + players.length - 1) % players.length]!.page;
    await expect(finalPlayerPage.locator(".trick-sweep .center-play")).toHaveCount(6);
    await finalPlayerPage.waitForTimeout(2_500);
    await expect(finalPlayerPage.locator(".trick-sweep .center-play")).toHaveCount(6);
  } finally {
    await closePlayers(players);
  }
});
