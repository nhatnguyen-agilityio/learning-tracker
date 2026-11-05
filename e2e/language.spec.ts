import { expect, type Page, test } from "@playwright/test";
import { signIn } from "./sign-in";

const viSignInText = /Gom nguồn học/;
const englishHeading = (page: Page) =>
  page.getByRole("heading", { name: "Settings" });
const vietnameseHeading = (page: Page) =>
  page.getByRole("heading", { name: "Cài đặt" });

async function openSettings(page: Page) {
  await signIn(page);
  await page.goto("/settings");
}

test("should keep the URL when changing the language", async ({ page }) => {
  await openSettings(page);
  const url = page.url();
  await expect(englishHeading(page)).toBeVisible();

  await page.getByRole("button", { name: "Tiếng Việt" }).click();

  await expect(vietnameseHeading(page)).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "vi");
  expect(page.url()).toBe(url);
});

test("should remember the language when reloading the page", async ({
  page,
}) => {
  await openSettings(page);
  await page.getByRole("button", { name: "Tiếng Việt" }).click();
  await expect(vietnameseHeading(page)).toBeVisible();

  await page.reload();

  await expect(vietnameseHeading(page)).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "vi");
});

test.describe("when the browser prefers Vietnamese", () => {
  test.use({ locale: "vi-VN" });

  test("should show Vietnamese on sign-in when the browser prefers it", async ({
    page,
  }) => {
    await page.goto("/sign-in");
    await expect(page.getByText(viSignInText)).toBeVisible();
  });
});
