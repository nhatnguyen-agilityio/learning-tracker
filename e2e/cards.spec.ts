import { expect, type Page, test } from "@playwright/test";
import { addResource } from "./resources";
import { signInNewUser } from "./sign-in";

const dialog = (page: Page) => page.getByRole("dialog");

async function openModal(page: Page) {
  await page.getByRole("button", { name: "Add a card" }).click();
  await expect(dialog(page)).toBeVisible();
}

async function fillSides(page: Page, front: string, back: string) {
  await dialog(page).getByLabel("Front").fill(front);
  await dialog(page).getByLabel("Back").fill(back);
}

const save = (page: Page) =>
  dialog(page).getByRole("button", { name: "Save card" }).click();

test.beforeEach(async ({ page }) => {
  await signInNewUser(page);
  await page.goto("/library");
  await addResource(page, "Carded guide");
  await page.getByRole("link", { name: /Carded guide/ }).click();
  await expect(
    page.getByRole("heading", { name: "Carded guide" }),
  ).toBeVisible();
});

test("should show a new card on the resource page", async ({ page }) => {
  await expect(page.getByText("This source has no cards yet.")).toBeVisible();

  await openModal(page);
  await fillSides(page, "What is a closure?", "A function with its scope");
  await save(page);

  await expect(dialog(page)).toBeHidden();
  const row = page
    .getByRole("listitem")
    .filter({ hasText: "What is a closure?" });
  await expect(row).toContainText("New");
});

test("should keep the card after reloading", async ({ page }) => {
  await openModal(page);
  await fillSides(page, "Kept question", "Kept answer");
  await save(page);
  await expect(dialog(page)).toBeHidden();

  await page.reload();

  await expect(page.getByText("Kept question")).toBeVisible();
});

test("should show errors and keep the text when a side is empty", async ({
  page,
}) => {
  await openModal(page);
  await fillSides(page, "Only a question", "");

  await save(page);

  await expect(dialog(page)).toContainText("The back cannot be empty.");
  await expect(dialog(page).getByLabel("Front")).toHaveValue("Only a question");
});

test("should show an error when a side is over 10 KB", async ({ page }) => {
  await openModal(page);
  await fillSides(page, "Question", "a".repeat(10 * 1024 + 1));

  await save(page);

  await expect(dialog(page)).toContainText("10 KB limit");
});

test("should not run HTML in the preview", async ({ page }) => {
  await openModal(page);
  await fillSides(
    page,
    `<img src=x onerror="window.cardHacked = true">`,
    "**Bold answer**",
  );

  await dialog(page).getByRole("button", { name: "Preview" }).click();

  await expect(dialog(page).getByText("Bold answer")).toBeVisible();
  await expect(dialog(page).locator("img")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => (window as unknown as { cardHacked?: boolean }).cardHacked,
    ),
  ).toBeUndefined();
});

test("should count the card when deleting the resource", async ({ page }) => {
  await openModal(page);
  await fillSides(page, "Stays", "Answer");
  await save(page);
  await expect(dialog(page)).toBeHidden();

  await page.getByRole("button", { name: "Delete source" }).click();

  await expect(dialog(page)).toContainText("1 card stays");
});
