import { expect, test } from "@playwright/test";

const viTagline = /Gom nguồn học/;
const enTagline = /Bring your learning sources/;

test("should keep the URL when changing the language", async ({ page }) => {
  await page.goto("/");
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
  await page.goto("/");
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
    await page.goto("/");
    await expect(page.getByText(viTagline)).toBeVisible();
  });
});
