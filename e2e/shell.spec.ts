import { expect, test } from "@playwright/test";
import { signIn } from "./sign-in";

const pages = [
  { link: "Library", path: "/library" },
  { link: "Cards", path: "/cards" },
  { link: "Settings", path: "/settings" },
  { link: "Today", path: "/" },
];

async function expectEachPageOpens(page: import("@playwright/test").Page) {
  const nav = page.getByRole("navigation", { name: "Main navigation" });

  for (const { link, path } of pages) {
    await nav.getByRole("link", { name: link }).click();

    await expect(page).toHaveURL(path);
    await expect(page.getByRole("heading", { name: link })).toBeVisible();
    await expect(nav.getByRole("link", { name: link })).toHaveAttribute(
      "aria-current",
      "page",
    );
  }
}

test("should open each page from the sidebar on desktop", async ({ page }) => {
  await signIn(page);

  await expectEachPageOpens(page);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 375, height: 720 } });

  test("should open each page from the bottom bar", async ({ page }) => {
    await signIn(page);

    await expectEachPageOpens(page);
  });

  test("should not scroll sideways when opening a page", async ({ page }) => {
    await signIn(page);

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );

    expect(overflows).toBe(false);
  });
});

test("should keep dark mode when reloading the page", async ({ page }) => {
  await signIn(page);
  await page.goto("/settings");

  await page.getByRole("button", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.reload();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("button", { name: "Dark" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("should use light when no theme was chosen", async ({ page }) => {
  await page.goto("/sign-in");

  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

for (const path of ["/library", "/cards", "/settings"]) {
  test(`should redirect to sign-in when opening a page signed out: ${path}`, async ({
    page,
  }) => {
    await page.goto(path);

    await expect(page).toHaveURL(/\/sign-in\?next=/);
  });
}
