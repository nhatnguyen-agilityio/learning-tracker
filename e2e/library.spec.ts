import { expect, test } from "@playwright/test";
import { addResource } from "./resources";
import { signInNewUser } from "./sign-in";

test.beforeEach(async ({ page }) => {
  await signInNewUser(page);
  await page.goto("/library");
});

test("should show the empty state when the user has no resources", async ({
  page,
}) => {
  await expect(page.getByText("Your library is empty")).toBeVisible();
});

test("should show a new resource right after saving", async ({ page }) => {
  await addResource(page, "A new guide");

  await expect(page.getByRole("link", { name: /A new guide/ })).toBeVisible();
  await expect(page.getByText("Your library is empty")).toBeHidden();
});

test("should show its topics and status", async ({ page }) => {
  await addResource(page, "Tagged guide", "Rust");

  const row = page.getByRole("link", { name: /Tagged guide/ });
  await expect(row).toContainText("Rust");
  await expect(row).toContainText("Done");
  await expect(row).toContainText("100%");
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 375, height: 720 } });

  test("should cut long titles without scrolling sideways", async ({
    page,
  }) => {
    await addResource(page, "Averyveryverylongwordwithoutspaces".repeat(8));

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );

    expect(overflows).toBe(false);
  });
});
