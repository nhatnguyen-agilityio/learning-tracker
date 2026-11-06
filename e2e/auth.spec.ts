import { expect, test } from "@playwright/test";
import { signIn } from "./sign-in";

test("should redirect to sign-in when signed out", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL("/sign-in");
  await expect(
    page.getByRole("button", { name: "Sign in with Google" }),
  ).toBeVisible();
});

test("should keep the target page when redirecting to sign-in", async ({
  page,
}) => {
  await page.goto("/library?status=done");

  await expect(page).toHaveURL(/\/sign-in\?next=/);
  await expect(page.locator('input[name="next"]')).toHaveValue(
    "/library?status=done",
  );
});

test("should open the home page when signed in", async ({ page }) => {
  await signIn(page);

  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
});

test("should leave the sign-in page when already signed in", async ({
  page,
}) => {
  await signIn(page);

  await page.goto("/sign-in");

  await expect(page).toHaveURL("/");
});

test("should show an error when the Google callback has no code", async ({
  page,
}) => {
  await page.goto("/auth/callback");

  await expect(page).toHaveURL("/sign-in?error=google");
  await expect(page.getByText(/could not sign you in/)).toBeVisible();
});

test("should switch language on the sign-in screen", async ({ page }) => {
  await page.goto("/sign-in");

  // Retries, because a click before hydration can be lost.
  await expect(async () => {
    await page.getByRole("button", { name: "Tiếng Việt" }).click();
    await expect(
      page.getByRole("button", { name: "Đăng nhập bằng Google" }),
    ).toBeVisible({ timeout: 3000 });
  }).toPass();
  await expect(page).toHaveURL("/sign-in");
});

test.describe("when the browser is in Tokyo", () => {
  test.use({ timezoneId: "Asia/Tokyo" });

  test("should send the browser time zone when signing in", async ({
    page,
  }) => {
    await page.goto("/sign-in");

    await expect(page.locator('input[name="timezone"]')).toHaveValue(
      "Asia/Tokyo",
    );
  });
});
