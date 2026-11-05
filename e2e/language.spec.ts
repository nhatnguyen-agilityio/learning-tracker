import { expect, test } from "@playwright/test";
import { signIn } from "./sign-in";

const viTagline = /Gom nguồn học/;
const enTagline = /Bring your learning sources/;

test("should keep the URL when changing the language", async ({ page }) => {
  await signIn(page);
  const url = page.url();
  await expect(page.getByText(enTagline)).toBeVisible();

  await page.getByRole("button", { name: "Tiếng Việt" }).click();

  await expect(page.getByText(viTagline)).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "vi");
  expect(page.url()).toBe(url);
});

test("should remember the language when reloading the page", async ({
  page,
}) => {
  await signIn(page);
  await page.getByRole("button", { name: "Tiếng Việt" }).click();
  await expect(page.getByText(viTagline)).toBeVisible();

  await page.reload();

  await expect(page.getByText(viTagline)).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "vi");
});

test.describe("when the browser prefers Vietnamese", () => {
  test.use({ locale: "vi-VN" });

  test("should show Vietnamese when there is no language cookie", async ({
    page,
  }) => {
    await signIn(page);
    await expect(page.getByText(viTagline)).toBeVisible();
  });
});
