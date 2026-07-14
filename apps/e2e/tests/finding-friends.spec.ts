import { expect, test } from "@playwright/test";
import {
  clickCard,
  closePlayers,
  createRoom,
  joinPlayers,
  type Player,
  readyPlayers,
} from "./helpers";

test("five humans bid, call one friend, and see the public call chip", async ({
  browser,
  request,
}) => {
  const roomId = await createRoom(request, {
    presetId: "shengji-ff-5p-2d-v1",
  });
  const players: Player[] = await joinPlayers(browser, roomId, 5);

  try {
    await readyPlayers(players);
    for (const { page } of players) {
      await expect(page.getByText("Declare trump")).toBeVisible({ timeout: 20_000 });
    }

    // A level card ("2 of …" at round 1) is the deterministic legal opening
    // bid. Selecting one enables "Bid selected"; the first hand with one wins.
    let bidderSeat = -1;
    for (let seat = 0; seat < players.length; seat += 1) {
      const page = players[seat]!.page;
      const levelCards = page.locator('.hand-scroll .playing-card[aria-label^="2 of"]');
      if ((await levelCards.count()) === 0) continue;
      await clickCard(levelCards.first());
      await page.getByRole("button", { name: "Bid selected" }).click();
      bidderSeat = seat;
      break;
    }
    expect(bidderSeat).toBeGreaterThanOrEqual(0);

    const bidder = players[bidderSeat]!;
    const buryButton = bidder.page.getByRole("button", { name: /^Bury 0 \/ / });
    await expect(buryButton).toBeVisible({ timeout: 8_000 });
    const bottomSize = Number((await buryButton.textContent())?.match(/\/ (\d+)/)?.[1]);
    expect(bottomSize).toBeGreaterThan(0);
    const hand = bidder.page.locator(".hand-scroll .playing-card");
    for (let index = 0; index < bottomSize; index += 1) {
      await clickCard(hand.nth(index));
    }
    await bidder.page
      .getByRole("button", { name: `Bury ${bottomSize} / ${bottomSize}` })
      .click();

    const callPanel = bidder.page.locator(".friend-call-panel");
    await expect(callPanel).toBeVisible({ timeout: 8_000 });
    await callPanel
      .locator("button.friend-call-suit-option:not([disabled])")
      .first()
      .click();
    await callPanel
      .locator("button.friend-call-rank-option:not([disabled])")
      .first()
      .click();
    await callPanel.getByRole("button", { name: /^1st ·/ }).click();
    await callPanel.getByRole("button", { name: /^Call friends/i }).click();

    for (const { page } of players) {
      await expect(page.locator(".friend-call-chips")).toBeVisible();
      await expect(page.locator(".friend-call-chips .friend-call-chip")).toHaveCount(1);
    }
  } finally {
    await closePlayers(players);
  }
});

test("finding-friends practice exposes the durable dashboard state", async ({
  page,
  request,
}) => {
  const roomId = await createRoom(request, {
    practice: true,
    presetId: "shengji-ff-5p-2d-v1",
  });

  await page.goto(`/room/${roomId}`);
  await page.getByLabel("Display name").fill("Practice player");
  await page.getByRole("button", { name: "Take a seat" }).click();
  await expect(page.locator(".connection-connected")).toContainText("Live");
  await page.locator(".lobby-seat").first().click();
  await page.getByRole("button", { name: "Ready up" }).click();

  // Bots deal, bid, bury, and auto-call; the FF dashboard and the durable
  // call-chip strip are the reliable end state (a bot always calls).
  await expect(page.locator(".finding-friends-panel")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".friend-rounds-won")).toBeVisible();
  await expect(page.locator(".friend-call-chips .friend-call-chip")).toHaveCount(1, {
    timeout: 45_000,
  });
});
