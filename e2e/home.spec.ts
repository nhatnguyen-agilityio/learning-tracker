import { expect, test } from "@playwright/test";
import { signIn } from "./sign-in";

test("should show Today when opening the home page", async ({ page }) => {
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
});
