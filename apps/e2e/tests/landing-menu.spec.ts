import { expect, test } from "@playwright/test";

test("landing mode select supports keyboard navigation and normalized room codes", async ({
  page,
}) => {
  await page.goto("/");

  const createTab = page.getByRole("tab", { name: "Create table" });
  const joinTab = page.getByRole("tab", { name: "Join table" });

  await expect(createTab).toHaveAttribute("aria-selected", "true");
  await createTab.focus();
  await createTab.press("ArrowDown");
  await expect(joinTab).toBeFocused();
  await expect(joinTab).toHaveAttribute("aria-selected", "true");

  await page.getByLabel("Table code").fill(" ab12cd ");
  await page.getByRole("button", { name: "Join table" }).click();
  await expect(page).toHaveURL(/\/room\/AB12CD$/);
});
