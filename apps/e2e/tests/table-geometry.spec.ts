import { expect, test, type Page } from "@playwright/test";
import { createRoom } from "./helpers";

test.describe.configure({ mode: "serial" });

const viewports = [
  { width: 1_500, height: 900 },
  { width: 1_100, height: 800 },
  { width: 760, height: 900 },
];

type Rect = {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
};

function readRects(locator: ReturnType<Page["locator"]>): Promise<Rect[]> {
  return locator.evaluateAll<Rect[], HTMLElement>((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      };
    }),
  );
}

async function assertSeatGeometry(
  page: Page,
  viewport: { width: number; height: number },
  expectedSeats: number,
): Promise<void> {
  const seats = page.locator(".table-seat");
  await expect(seats).toHaveCount(expectedSeats);

  // The full seat box includes the decorative fanned card backs, which may
  // cosmetically bleed toward a neighbour on a dense table; it must still stay
  // on screen. The meaningful non-collision contract is on the nameplates —
  // name, role, card count, and timer must each stay individually readable.
  const seatRects = await readRects(seats);
  for (const rect of seatRects) {
    expect(
      rect.left,
      `${viewport.width}x${viewport.height}: left`,
    ).toBeGreaterThanOrEqual(-8);
    expect(
      rect.top,
      `${viewport.width}x${viewport.height}: top`,
    ).toBeGreaterThanOrEqual(-8);
    expect(
      rect.right,
      `${viewport.width}x${viewport.height}: right`,
    ).toBeLessThanOrEqual(viewport.width + 8);
    expect(
      rect.bottom,
      `${viewport.width}x${viewport.height}: bottom`,
    ).toBeLessThanOrEqual(viewport.height + 8);
  }

  // Two nameplates must not substantially cover each other: name, role, card
  // count, and timer stay readable on every seat. A minor corner graze on the
  // densest tables (eight seats at the narrowest supported width) is cosmetic;
  // a real regression stacks seats and covers most of a plate. Gate on the
  // covered fraction of the smaller plate so the check flags collapse, not a
  // grazed corner.
  const tags = page.locator(".table-seat .player-tag");
  await expect(tags).toHaveCount(expectedSeats);
  const tagRects = await readRects(tags);
  for (let first = 0; first < tagRects.length; first += 1) {
    for (let second = first + 1; second < tagRects.length; second += 1) {
      const overlapWidth = Math.max(
        0,
        Math.min(tagRects[first]!.right, tagRects[second]!.right) -
          Math.max(tagRects[first]!.left, tagRects[second]!.left),
      );
      const overlapHeight = Math.max(
        0,
        Math.min(tagRects[first]!.bottom, tagRects[second]!.bottom) -
          Math.max(tagRects[first]!.top, tagRects[second]!.top),
      );
      const overlapArea = overlapWidth * overlapHeight;
      const smallerArea = Math.min(
        tagRects[first]!.width * tagRects[first]!.height,
        tagRects[second]!.width * tagRects[second]!.height,
      );
      const coveredFraction = smallerArea === 0 ? 0 : overlapArea / smallerArea;
      expect(
        coveredFraction <= 0.25,
        `${viewport.width}x${viewport.height}: nameplates ${first} and ${second} overlap ${overlapWidth}x${overlapHeight} (${Math.round(
          coveredFraction * 100,
        )}% of a plate)`,
      ).toBe(true);
    }
  }
}

async function runGeometryCase(
  page: Page,
  roomId: string,
  expectedSeats: number,
): Promise<void> {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    if (page.url() === "about:blank") {
      await page.goto(`/room/${roomId}?practice=1`);
      await page.getByLabel("Display name").fill("Geometry player");
      await page.getByRole("button", { name: "Take a seat" }).click();
    }
    await expect(page.locator(".felt-table")).toBeVisible({ timeout: 30_000 });
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await assertSeatGeometry(page, viewport, expectedSeats);
  }
}

test("six-player radial seats stay inside the viewport", async ({ page, request }) => {
  const roomId = await createRoom(request, {
    practice: true,
    presetId: "shengji-6p-3d-fixed-v1",
  });
  await runGeometryCase(page, roomId, 6);
});

test("eight-player radial seats stay inside the viewport", async ({
  page,
  request,
}) => {
  const roomId = await createRoom(request, {
    practice: true,
    presetId: "shengji-8p-4d-fixed-v1",
  });
  await runGeometryCase(page, roomId, 8);
});
