import { expect, test } from "@playwright/test";
import { signIn } from "./sign-in";

test("should show the app name when opening the home page", async ({
  page,
}) => {
  await signIn(page);
  await expect(
    page.getByRole("heading", { name: "Learning Tracker" }),
  ).toBeVisible();
});
