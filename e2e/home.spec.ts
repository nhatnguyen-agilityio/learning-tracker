import { expect, test } from "@playwright/test";

test("should show the app name when opening the home page", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Learning Tracker" }),
  ).toBeVisible();
});
