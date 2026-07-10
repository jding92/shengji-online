import { expect, test } from "@playwright/test";

test("practice drops the human straight into a game against three bots", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Practice" }).click();
  await page
    .getByRole("group", { name: "Practice difficulty" })
    .getByRole("button", { name: "Advanced" })
    .click();
  await page.getByRole("button", { name: "Start practice" }).click();

  // No manual lobby step: the human is auto-seated, auto-readied, and dealt in.
  await expect(page.locator(".hand-scroll .playing-card")).toHaveCount(25, {
    timeout: 15_000,
  });
  await expect(page.locator(".table-seat .bot-badge")).toHaveCount(3);
  // The lobby ready control and the legacy practice switcher are both gone.
  await expect(page.getByRole("button", { name: "Ready up" })).toHaveCount(0);
  await expect(page.getByRole("tablist", { name: "Practice players" })).toHaveCount(0);
  // Bots bid and play on their own.
  await expect(page.locator(".bid-badge")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".center-play").first()).toBeVisible({ timeout: 25_000 });
});

test("a human can add and remove a lobby bot", async ({ page, request }) => {
  const created = await request.post("/api/rooms", { data: {} });
  expect(created.ok()).toBe(true);
  const roomId = ((await created.json()) as { room: { roomId: string } }).room.roomId;

  await page.goto(`/room/${roomId}`);
  await page.getByLabel("Display name").fill("Ada");
  await page.getByRole("button", { name: "Take a seat" }).click();
  await expect(page.getByRole("heading", { name: `Room ${roomId}` })).toBeVisible();
  await page.locator(".lobby-seat").first().click();

  const seat = page.locator(".lobby-seat").nth(1);
  await seat.getByLabel("Bot difficulty for seat 2").selectOption("advanced");
  await seat.getByRole("button", { name: "Add bot" }).click();
  await expect(seat.getByText("Bot · Advanced")).toBeVisible();
  await seat.getByRole("button", { name: /^Remove / }).click();
  await expect(seat.getByText("Open seat")).toBeVisible();
});
