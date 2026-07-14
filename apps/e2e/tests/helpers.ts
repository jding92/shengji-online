import {
  expect,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from "@playwright/test";

export type Player = { context: BrowserContext; page: Page };

export async function createRoom(
  request: APIRequestContext,
  data: Record<string, unknown> = {},
): Promise<string> {
  const response = await request.post("/api/rooms", { data });
  if (!response.ok()) {
    throw new Error(`Room creation failed with ${response.status()}`);
  }
  const body = (await response.json()) as { room: { roomId: string } };
  return body.room.roomId;
}

export async function joinPlayers(
  browser: Browser,
  roomId: string,
  count: number,
): Promise<Player[]> {
  const players: Player[] = [];
  for (let seat = 0; seat < count; seat += 1) {
    const context = await browser.newContext();
    const page = await context.newPage();
    players.push({ context, page });
    await page.goto(`/room/${roomId}`);
    await page.getByLabel("Display name").fill(`Player ${seat + 1}`);
    await page.getByRole("button", { name: "Take a seat" }).click();
    await expectHeading(page, roomId);
    // The REST-backed room can render before its WebSocket is ready.
    await expect(page.locator(".connection-connected")).toContainText("Live");
    await page.locator(".lobby-seat").nth(seat).click();
  }
  return players;
}

export async function readyPlayers(players: readonly Player[]): Promise<void> {
  for (const { page } of players) {
    await page.getByRole("button", { name: "Ready up" }).click();
  }
}

export async function closePlayers(players: readonly Player[]): Promise<void> {
  await Promise.allSettled(players.map(({ context }) => context.close()));
}

export async function clickCard(card: Locator): Promise<void> {
  await card.evaluate((element: HTMLButtonElement) => element.click());
}

export function playButton(page: Page): Locator {
  return page.locator(".hand-actions").getByRole("button", {
    name: /^Play(?:\s|$)/,
  });
}

export async function expectHeading(page: Page, roomId: string): Promise<void> {
  await page.getByRole("heading", { name: `Room ${roomId}` }).waitFor({
    state: "visible",
  });
}

export function cardLabelParts(label: string): {
  rank: string;
  suit: string | undefined;
} {
  const [rank = "", suit] = label.split(" of ");
  return { rank, suit };
}

export async function playLowestSingle(
  page: Page,
  ledSuit: string | undefined,
): Promise<void> {
  const hand = page.locator(".hand-scroll .playing-card");
  let choice = 0;
  if (ledSuit !== undefined) {
    for (let index = 0; index < (await hand.count()); index += 1) {
      const label = (await hand.nth(index).getAttribute("aria-label")) ?? "";
      const parts = cardLabelParts(label);
      if (parts.suit === ledSuit && parts.rank !== "2") {
        choice = index;
        break;
      }
    }
  }
  await clickCard(hand.nth(choice));
  await playButton(page).click();
}
