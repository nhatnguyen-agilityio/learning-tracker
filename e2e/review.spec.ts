import { expect, type Page, test } from "@playwright/test";
import { addResource } from "./resources";
import { signInNewUser } from "./sign-in";

const dialog = (page: Page) => page.getByRole("dialog");
const rating = (page: Page, name: string) =>
  page.getByRole("button", { name: new RegExp(`^${name}`) });

async function addCards(page: Page, sides: [string, string][]) {
  await page.goto("/library");
  await addResource(page, "Studied guide");
  await page.getByRole("link", { name: /Studied guide/ }).click();
  await expect(
    page.getByRole("heading", { name: "Studied guide" }),
  ).toBeVisible();
  for (const [front, back] of sides) {
    await page.getByRole("button", { name: "Add a card" }).click();
    await dialog(page).getByLabel("Front").fill(front);
    await dialog(page).getByLabel("Back").fill(back);
    await dialog(page).getByRole("button", { name: "Save card" }).click();
    await expect(dialog(page)).toBeHidden();
  }
}

/** Keeps pressing until the page has hydrated and the card turns over. */
async function flip(page: Page) {
  await expect(async () => {
    await page.keyboard.press("Space");
    await expect(rating(page, "Remembered")).toBeVisible({ timeout: 200 });
  }).toPass();
}

async function startReview(page: Page) {
  await page.goto("/");
  await page.getByRole("link", { name: "Start reviewing" }).click();
  await expect(page).toHaveURL(/\/review$/);
}

test.beforeEach(async ({ page }) => {
  await signInNewUser(page);
});

test("should review a small batch with the keyboard", async ({ page }) => {
  await addCards(page, [
    ["First question", "First answer"],
    ["Second question", "Second answer"],
  ]);
  await startReview(page);
  await expect(page.getByText("2 cards left")).toBeVisible();
  await expect(rating(page, "Remembered")).toBeHidden();

  await flip(page);
  const saved = page.waitForResponse("**/api/reviews");
  await page.keyboard.press("3");

  expect((await saved).status()).toBe(200);
  await expect(page.getByText("1 card left")).toBeVisible();
  await expect(rating(page, "Remembered")).toBeHidden();

  await flip(page);
  await page.keyboard.press("2");

  await expect(page.getByText("No cards left for now.")).toBeVisible();
});

test("should not rate with a number before flipping", async ({ page }) => {
  await addCards(page, [["Only question", "Only answer"]]);
  await startReview(page);
  await flip(page);
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(page.getByText("1 card left")).toBeVisible();
  await expect(async () => {
    await page.keyboard.press("3");
    await expect(page.getByText("1 card left")).toBeVisible();
  }).toPass();

  await flip(page);
  await expect(page.getByText("1 card left")).toBeVisible();
});

test("should flip and rate by tapping", async ({ page }) => {
  await addCards(page, [["Tap question", "Tap answer"]]);
  await startReview(page);

  await page.getByRole("button", { name: "Show answer" }).first().click();
  await rating(page, "Vaguely").click();

  await expect(page.getByText("No cards left for now.")).toBeVisible();
});

test("should show the help line after flipping", async ({ page }) => {
  await addCards(page, [["Help question", "Help answer"]]);
  await startReview(page);

  await flip(page);

  await expect(
    page.getByText("Could not recall the answer? Choose Forgot."),
  ).toBeVisible();
});

test("should not show a rated card again after reloading", async ({ page }) => {
  await addCards(page, [
    ["Rated question", "Answer"],
    ["Waiting question", "Answer"],
  ]);
  await startReview(page);
  await flip(page);
  const saved = page.waitForResponse("**/api/reviews");
  await page.keyboard.press("3");
  await saved;

  await page.reload();

  await expect(page.getByText("1 card left")).toBeVisible();
  await expect(page.getByText("Waiting question").first()).toBeVisible();
});

test("should say so when there are no cards", async ({ page }) => {
  await page.goto("/review");

  await expect(page.getByText("No cards left for now.")).toBeVisible();
  await page.getByRole("link", { name: "Back to Today" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("should leave through the exit link", async ({ page }) => {
  await addCards(page, [["Exit question", "Answer"]]);
  await startReview(page);

  await page.getByRole("link", { name: "Exit" }).click();

  await expect(page).toHaveURL(/\/$/);
});

test("should show markdown and not run HTML", async ({ page }) => {
  await addCards(page, [
    [`<img src=x onerror="window.reviewHacked = true">**Bold front**`, "Back"],
  ]);
  await startReview(page);

  await expect(
    page.locator("strong", { hasText: "Bold front" }).first(),
  ).toBeVisible();
  await expect(page.locator('img[src="x"]')).toHaveCount(0);
  expect(
    await page.evaluate(
      () => (window as unknown as { reviewHacked?: boolean }).reviewHacked,
    ),
  ).toBeUndefined();
});

test("should not show another user's cards", async ({ page, context }) => {
  await addCards(page, [["Private question", "Answer"]]);

  await context.clearCookies();
  await signInNewUser(page);
  await page.goto("/review");

  await expect(page.getByText("No cards left for now.")).toBeVisible();
  await expect(page.getByText("Private question")).toHaveCount(0);
});
