import {
  expect,
  test,
  type BrowserContext,
  type Locator,
  type Page,
} from "@playwright/test";

type Player = { context: BrowserContext; page: Page };

async function clickCard(card: Locator): Promise<void> {
  await card.evaluate((element: HTMLButtonElement) => element.click());
}

test("four players join, bid, bury, and complete a legal trick", async ({
  browser,
  request,
}) => {
  const created = await request.post("/api/rooms", { data: {} });
  expect(created.ok()).toBe(true);
  const roomId = ((await created.json()) as { room: { roomId: string } }).room.roomId;
  const players: Player[] = [];

  try {
    for (let seat = 0; seat < 4; seat += 1) {
      const context = await browser.newContext();
      const page = await context.newPage();
      players.push({ context, page });
      await page.goto(`/room/${roomId}`);
      await page.getByLabel("Display name").fill(`Player ${seat + 1}`);
      await page.getByRole("button", { name: "Take a seat" }).click();
      await expect(page.getByRole("heading", { name: `Room ${roomId}` })).toBeVisible();
      await page.locator(".lobby-seat").nth(seat).click();
    }

    for (const { page } of players) {
      await page.getByRole("button", { name: "Ready up" }).click();
    }
    for (const { page } of players) {
      await expect(page.getByText("YOUR HAND")).toBeVisible();
      await expect(page.locator(".hand-scroll .playing-card")).toHaveCount(25);
      await expect(page.getByText("Declare trump")).toBeVisible();
    }
    await players[3]!.page.reload();
    await expect(players[3]!.page.locator(".hand-scroll .playing-card")).toHaveCount(
      25,
    );
    await expect(players[3]!.page.getByText("Declare trump")).toBeVisible();

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
    await expect(
      bidder.page.getByRole("button", { name: "Play selected" }),
    ).toBeVisible();

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
    await bidder.page.getByRole("button", { name: "Play selected" }).click();

    for (let offset = 1; offset < 4; offset += 1) {
      const seat = (bidderSeat + offset) % 4;
      const page = players[seat]!.page;
      await expect(page.getByRole("button", { name: "Play selected" })).toBeVisible();
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
      await page.getByRole("button", { name: "Play selected" }).click();
    }

    for (const { page } of players) {
      await expect(page.locator(".hand-scroll .playing-card")).toHaveCount(24);
    }
  } finally {
    await Promise.allSettled(players.map(({ context }) => context.close()));
  }
});
