import { expect, type Page, test } from "@playwright/test";
import { signInNewUser } from "./sign-in";

const dialog = (page: Page) => page.getByRole("dialog");
const row = (page: Page, name: string) =>
  page.getByRole("listitem").filter({ hasText: name });

async function createToken(page: Page, name: string) {
  await page.getByLabel("New token name").fill(name);
  await expect(async () => {
    await page.getByRole("button", { name: "Create token" }).click();
    await expect(page.getByText("It is shown only once.")).toBeVisible({
      timeout: 2000,
    });
  }).toPass();
}

test.beforeEach(async ({ page }) => {
  await signInNewUser(page);
  await page.goto("/settings");
});

test("should show a new token only once", async ({ page }) => {
  await createToken(page, "Laptop");

  const token = await page.getByText(/^lt_/).textContent();
  expect(token).toMatch(/^lt_/);
  await expect(row(page, "Laptop")).toContainText("Never used");

  await page.getByRole("button", { name: "I saved it" }).click();
  await expect(page.getByText(/^lt_/)).toBeHidden();

  await page.reload();
  await expect(row(page, "Laptop")).toBeVisible();
  await expect(page.getByText(token ?? "")).toBeHidden();
});

test("should copy the token", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await createToken(page, "Copied");
  const token = await page.getByText(/^lt_/).textContent();

  await page.getByRole("button", { name: "Copy" }).last().click();

  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(token);
});

test("should revoke a token after confirming", async ({ page }) => {
  await createToken(page, "Old laptop");
  await page.getByRole("button", { name: "I saved it" }).click();

  await row(page, "Old laptop").getByRole("button", { name: "Revoke" }).click();
  await dialog(page).getByRole("button", { name: "Revoke token" }).click();

  await expect(row(page, "Old laptop")).toBeHidden();
  await page.reload();
  await expect(page.getByText("Old laptop")).toBeHidden();
});

test("should keep the token when cancelling", async ({ page }) => {
  await createToken(page, "Kept laptop");
  await page.getByRole("button", { name: "I saved it" }).click();

  await row(page, "Kept laptop")
    .getByRole("button", { name: "Revoke" })
    .click();
  await dialog(page).getByRole("button", { name: "Cancel" }).click();

  await expect(dialog(page)).toBeHidden();
  await page.reload();
  await expect(row(page, "Kept laptop")).toBeVisible();
});

test("should ask for a name", async ({ page }) => {
  await expect(async () => {
    await page.getByRole("button", { name: "Create token" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toBeVisible({
      timeout: 1000,
    });
  }).toPass();

  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Enter a name",
  );
});
