import { expect, test } from "@playwright/test";
import { closePlayers, type Player } from "./helpers";

test("create a six-player preset and edit lobby rules as host", async ({ browser }) => {
  const players: Player[] = [];
  try {
    const creatorContext = await browser.newContext();
    const page = await creatorContext.newPage();
    players.push({ context: creatorContext, page });
    await page.goto("/");
    await page.getByRole("tab", { name: "Create table" }).click();
    await expect(page.locator(".preset-card")).toHaveCount(8);
    await page.getByRole("button", { name: /Sheng Ji 6P Fixed Teams/ }).click();
    await page.getByRole("button", { name: /^Create table$/ }).click();
    await expect(page).toHaveURL(/\/room\/[A-Z0-9]+$/);

    const roomId = new URL(page.url()).pathname.split("/").at(-1)!;
    await page.getByLabel("Display name").fill("Creator");
    await page.getByRole("button", { name: "Take a seat" }).click();
    await expect(page.locator(".rules-ribbon")).toContainText("6 PLAYERS");
    await expect(page.locator(".rules-ribbon")).toContainText("3 DECKS");
    await expect(page.locator(".lobby-seat")).toHaveCount(6);
    await expect(page.locator(".connection-connected")).toContainText("Live");
    await page.locator(".lobby-seat").nth(0).click();
    await expect(
      page.locator(".lobby-seat").nth(0).locator(".host-badge"),
    ).toBeVisible();

    const secondContext = await browser.newContext();
    const secondPage = await secondContext.newPage();
    players.push({ context: secondContext, page: secondPage });
    await secondPage.goto(`/room/${roomId}`);
    await secondPage.getByLabel("Display name").fill("Second player");
    await secondPage.getByRole("button", { name: "Take a seat" }).click();
    await expect(secondPage.locator(".connection-connected")).toContainText("Live");
    await expect(secondPage.locator(".lobby-seat")).toHaveCount(6);
    await secondPage.locator(".lobby-seat").nth(1).click();

    for (const player of players) {
      await player.page.getByRole("button", { name: "Ready up" }).click();
    }
    for (const player of players) {
      await expect(player.page.locator(".ready-stamp")).toHaveCount(2);
    }

    const dialog = page.getByRole("dialog");
    await page.getByRole("button", { name: /TABLE RULES/i }).click();
    await expect(dialog).toBeVisible();
    await dialog
      .getByRole("group", { name: "DECKS · 牌副数" })
      .getByRole("button", { name: "4", exact: true })
      .click();
    await dialog.getByRole("button", { name: /APPLY OPTIONS/i }).click();

    for (const player of players) {
      await expect(player.page.locator(".ready-stamp")).toHaveCount(0);
    }
    await expect(secondPage.locator(".lobby-notice")).toBeVisible();
    await expect(page.locator(".lobby-notice")).toBeVisible();

    // Keep the room in a healthy lobby state if this spec is extended later.
    for (const player of players) {
      await player.page.getByRole("button", { name: "Ready up" }).click();
    }
  } finally {
    await closePlayers(players);
  }
});
