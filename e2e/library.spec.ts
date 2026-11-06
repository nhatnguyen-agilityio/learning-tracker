import { expect, type Page, test } from "@playwright/test";
import { signInNewUser } from "./sign-in";

async function addResource(page: Page, title: string, topic?: string) {
  await page.getByRole("button", { name: "Add a source" }).click();
  const link = page.getByLabel("Paste a link");
  await link.fill(`https://no-such-host.invalid/${crypto.randomUUID()}`);
  await link.press("Enter");
  await page.getByLabel("Title").fill(title);
  if (topic) {
    await page.getByRole("combobox").fill(topic);
    await page.getByRole("button", { name: `Create "${topic}"` }).click();
  }
  await page.getByRole("button", { name: "Done" }).click();
  await page.getByRole("button", { name: "Save source" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
}

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
