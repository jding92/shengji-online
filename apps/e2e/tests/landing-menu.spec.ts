import { expect, test } from "@playwright/test";

test("landing mode select supports keyboard navigation and normalized room codes", async ({
  page,
}) => {
  await page.goto("/");

  const startTab = page.getByRole("tab", { name: "Start game" });
  const joinTab = page.getByRole("tab", { name: "Join table" });

  await expect(startTab).toHaveAttribute("aria-selected", "true");
  await startTab.focus();
  await startTab.press("ArrowDown");
  await expect(joinTab).toBeFocused();
  await expect(joinTab).toHaveAttribute("aria-selected", "true");

  await page.getByLabel("Table code").fill(" ab12cd ");
  await page.getByRole("button", { name: "Join table" }).click();
  await expect(page).toHaveURL(/\/room\/AB12CD$/);
});
