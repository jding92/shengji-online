import { expect, test } from "@playwright/test";

test("practice creates one human session with three configured bots", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Practice difficulty").selectOption("advanced");
  await page.getByRole("button", { name: "Practice table · solo" }).click();

  await expect(page.getByRole("heading", { name: /^Room / })).toBeVisible();
  await expect(page.getByText("Bot · Advanced")).toHaveCount(3);
  await expect(page.getByText("You")).toBeVisible();
  await expect(page.getByRole("tablist", { name: "Practice players" })).toHaveCount(0);

  await page.getByRole("button", { name: "Ready up" }).click();
  await expect(page.locator(".hand-scroll .playing-card")).toHaveCount(25);
  await expect(page.locator(".bid-badge")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(".center-play")).toBeVisible({ timeout: 25_000 });
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
