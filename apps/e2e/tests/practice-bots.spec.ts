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

test("table orbit and HUD stay usable at supported desktop viewports", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("tab", { name: "Practice" }).click();
  await page.getByRole("button", { name: "Start practice" }).click();
  await expect(page.locator(".hand-scroll .playing-card")).toHaveCount(25, {
    timeout: 15_000,
  });

  for (const viewport of [
    { width: 2561, height: 1286 },
    { width: 1499, height: 828 },
    { width: 1280, height: 720 },
    { width: 1024, height: 768 },
  ]) {
    await page.setViewportSize(viewport);
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await page.waitForTimeout(100);
    await expect(page.locator(".table-orbit")).toBeVisible();
    await expect(page.locator(".south-cluster")).toBeVisible();
    await expect(page.locator(".hand-scroll")).toBeVisible();

    const layout = await page.evaluate(() => {
      const rect = (selector: string) => {
        const element = document.querySelector(selector);
        if (!(element instanceof HTMLElement)) throw new Error(`Missing ${selector}`);
        return element.getBoundingClientRect();
      };
      const rectValues = (value: DOMRect) => ({
        top: value.top,
        right: value.right,
        bottom: value.bottom,
        left: value.left,
        width: value.width,
        height: value.height,
      });
      const felt = rect(".felt-table");
      const orbit = rect(".table-orbit");
      const northTag = rect(".seat-north .player-tag");
      const hand = rect(".hand-scroll");
      const firstHandCard = rect(".hand-scroll .playing-card");
      const handCards = [
        ...document.querySelectorAll(".hand-scroll .playing-card"),
      ].map((card) => card.getBoundingClientRect());
      const actions = rect(".south-cluster");
      const dashboard = document.querySelector(".side-panel");
      if (!(dashboard instanceof HTMLElement)) throw new Error("Missing dashboard");
      const dashboardRect = dashboard.getBoundingClientRect();
      const horizontalHud = dashboardRect.width >= window.innerWidth - 2;
      const sections = [...dashboard.querySelectorAll(".dashboard-section")].map(
        (section) => section.getBoundingClientRect(),
      );
      const opponentFans = [...document.querySelectorAll(".table-seat .mini-hand")].map(
        (fan) => {
          const fanRect = fan.getBoundingClientRect();
          const seat = fan.closest(".table-seat");
          if (!(seat instanceof HTMLElement)) throw new Error("Fan missing seat");
          const position = ["north", "east", "west"].find((candidate) =>
            seat.classList.contains(`seat-${candidate}`),
          );
          if (position === undefined) throw new Error("Unknown opponent position");
          return { position, rect: rectValues(fanRect) };
        },
      );
      const opponentModules = [
        ...document.querySelectorAll(
          ".table-orbit > .table-seat .player-tag, .table-orbit > .table-seat .mini-hand",
        ),
      ].map((module) => module.getBoundingClientRect());
      const ringClearance = 7;
      return {
        centerDeltaX: Math.abs(
          orbit.left + orbit.width / 2 - (felt.left + felt.width / 2),
        ),
        centerDeltaY: Math.abs(
          orbit.top + orbit.height / 2 - (felt.top + felt.height / 2),
        ),
        northTagClearsRing: northTag.bottom <= orbit.top + 4,
        northTagClearsHud: !horizontalHud || northTag.top >= dashboardRect.bottom - 1,
        northHudOverlap: dashboardRect.bottom - northTag.top,
        dashboardHasNoVerticalOverflow:
          dashboard.scrollHeight <= dashboard.clientHeight + 1,
        dashboardSectionsVisible:
          !horizontalHud ||
          sections.every(
            (section) =>
              section.top >= dashboardRect.top - 1 &&
              section.bottom <= dashboardRect.bottom + 1,
          ),
        dashboardKeepsHorizontalScroll:
          !horizontalHud || getComputedStyle(dashboard).overflowX === "auto",
        handVisible:
          hand.top >= 0 && hand.bottom <= window.innerHeight + 1 && hand.height > 100,
        handGeometry: rectValues(hand),
        handCardsNotBottomClipped: handCards.every(
          (card) =>
            card.bottom <= Math.min(hand.bottom, window.innerHeight) + 1 &&
            card.bottom > card.top,
        ),
        handCardBottomOverflow: Math.max(
          ...handCards.map((card) => card.bottom - Math.min(hand.bottom, innerHeight)),
        ),
        actionsVisible:
          actions.left < window.innerWidth && actions.right > 0 && actions.bottom > 0,
        actionsClearHandCards: actions.bottom <= firstHandCard.top + 1,
        opponentFansOutsideRing: opponentFans.every(({ position, rect: fan }) => {
          if (position === "north") return fan.bottom <= orbit.top - ringClearance;
          if (position === "east") return fan.left >= orbit.right + ringClearance;
          return fan.right <= orbit.left - ringClearance;
        }),
        opponentModulesWithinViewport: opponentModules.every(
          (module) =>
            module.top >= -1 &&
            module.right <= window.innerWidth + 1 &&
            module.bottom <= window.innerHeight + 1 &&
            module.left >= -1,
        ),
      };
    });

    expect(
      layout.centerDeltaX,
      `${viewport.width}x${viewport.height}: orbit horizontal offset`,
    ).toBeLessThanOrEqual(1);
    expect(
      layout.centerDeltaY,
      `${viewport.width}x${viewport.height}: orbit vertical offset`,
    ).toBeLessThanOrEqual(1);
    expect(layout.northTagClearsRing).toBe(true);
    expect(
      layout.northTagClearsHud,
      `${viewport.width}x${viewport.height}: north tag overlaps HUD by ${layout.northHudOverlap}px`,
    ).toBe(true);
    expect(layout.dashboardHasNoVerticalOverflow).toBe(true);
    expect(layout.dashboardSectionsVisible).toBe(true);
    expect(layout.dashboardKeepsHorizontalScroll).toBe(true);
    expect(
      layout.handVisible,
      `${viewport.width}x${viewport.height}: hand geometry ${JSON.stringify(layout.handGeometry)}`,
    ).toBe(true);
    expect(
      layout.handCardsNotBottomClipped,
      `${viewport.width}x${viewport.height}: hand card bottom overflow ${layout.handCardBottomOverflow}px`,
    ).toBe(true);
    expect(layout.actionsVisible).toBe(true);
    expect(layout.actionsClearHandCards).toBe(true);
    expect(layout.opponentFansOutsideRing).toBe(true);
    expect(layout.opponentModulesWithinViewport).toBe(true);
  }
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
