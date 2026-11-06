import { expect, type Page, test } from "@playwright/test";
import postgres from "postgres";
import { addResource } from "./resources";
import { signInNewUser } from "./sign-in";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const dialog = (page: Page) => page.getByRole("dialog");
const row = (page: Page, text: string) =>
  page.getByRole("listitem").filter({ hasText: text });

async function addCard(page: Page, front: string, back: string) {
  await page.getByRole("button", { name: "Add a card" }).click();
  await dialog(page).getByLabel("Front").fill(front);
  await dialog(page).getByLabel("Back").fill(back);
  await dialog(page).getByRole("button", { name: "Save card" }).click();
  await expect(dialog(page)).toBeHidden();
}

async function openNewResource(page: Page, title: string) {
  await page.goto("/library");
  await addResource(page, title);
  await page.getByRole("link", { name: new RegExp(title) }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await signInNewUser(page);
});

test("should show the empty state when there are no cards", async ({
  page,
}) => {
  await page.goto("/cards");

  await expect(page.getByText("No cards yet")).toBeVisible();
  await expect(page.getByText("0 cards")).toBeVisible();
});

test("should show the new text after editing a card", async ({ page }) => {
  await openNewResource(page, "Edited guide");
  await addCard(page, "Old question", "Old answer");
  await page.goto("/cards");
  await expect(row(page, "Old question")).toContainText("Edited guide");

  await row(page, "Old question").getByRole("button", { name: "Edit" }).click();
  await expect(dialog(page).getByLabel("Back")).toHaveValue("Old answer");
  await dialog(page).getByLabel("Front").fill("New question");
  await dialog(page).getByRole("button", { name: "Save card" }).click();

  await expect(dialog(page)).toBeHidden();
  await expect(row(page, "New question")).toBeVisible();
  await page.reload();
  await expect(row(page, "New question")).toBeVisible();
  await expect(page.getByText("Old question")).toBeHidden();
});

test("should keep the text and show an error when a side is emptied", async ({
  page,
}) => {
  await openNewResource(page, "Strict guide");
  await addCard(page, "A question", "An answer");
  await page.goto("/cards");

  await row(page, "A question").getByRole("button", { name: "Edit" }).click();
  await expect(dialog(page).getByLabel("Back")).toHaveValue("An answer");
  await dialog(page).getByLabel("Back").fill("");
  await dialog(page).getByRole("button", { name: "Save card" }).click();

  await expect(dialog(page)).toContainText("The back cannot be empty.");
  await expect(dialog(page).getByLabel("Front")).toHaveValue("A question");
});

test("should show No source after the resource is deleted", async ({
  page,
}) => {
  await openNewResource(page, "Gone guide");
  await addCard(page, "Survivor", "Answer");

  await page.getByRole("button", { name: "Delete source" }).click();
  await dialog(page).getByRole("button", { name: "Delete source" }).click();
  await expect(page).toHaveURL(/\/library$/);
  await page.goto("/cards");

  await expect(row(page, "Survivor")).toContainText("No source");
});

test("should show more cards when asked", async ({ page }) => {
  const title = `Long guide ${crypto.randomUUID()}`;
  await openNewResource(page, title);

  const sql = postgres(databaseUrl);
  try {
    await sql`
      insert into cards (user_id, resource_id, front, back)
      select user_id, id, 'Seeded ' || n, 'Answer'
      from resources, generate_series(1, 101) as n
      where title = ${title}`;
  } finally {
    await sql.end();
  }

  await page.goto("/cards");
  await expect(page.getByText("101 cards")).toBeVisible();
  await expect(page.getByRole("listitem")).toHaveCount(100);

  await page.getByRole("link", { name: "Show more" }).click();

  await expect(page.getByRole("listitem")).toHaveCount(101);
  await expect(page.getByRole("link", { name: "Show more" })).toBeHidden();
});

test("should suspend and resume a card", async ({ page }) => {
  await openNewResource(page, "Paused guide");
  await addCard(page, "Pause me", "Answer");
  await page.goto("/cards");

  await row(page, "Pause me").getByRole("button", { name: "Suspend" }).click();
  await expect(row(page, "Pause me")).toContainText("Suspended");
  await page.reload();
  await expect(row(page, "Pause me")).toContainText("Suspended");

  await row(page, "Pause me").getByRole("button", { name: "Resume" }).click();

  await expect(row(page, "Pause me")).toContainText("New");
  await expect(
    row(page, "Pause me").getByRole("button", { name: "Suspend" }),
  ).toBeVisible();
});

test("should delete a card after confirming", async ({ page }) => {
  await openNewResource(page, "Trimmed guide");
  await addCard(page, "Delete me", "Answer");
  await page.goto("/cards");

  await row(page, "Delete me").getByRole("button", { name: "Delete" }).click();
  await dialog(page).getByRole("button", { name: "Delete card" }).click();

  await expect(page.getByText("Delete me")).toBeHidden();
  await page.reload();
  await expect(page.getByText("No cards yet")).toBeVisible();
});

test("should keep the card when cancelling the delete", async ({ page }) => {
  await openNewResource(page, "Kept guide");
  await addCard(page, "Keep me", "Answer");
  await page.goto("/cards");

  await row(page, "Keep me").getByRole("button", { name: "Delete" }).click();
  await dialog(page).getByRole("button", { name: "Cancel" }).click();

  await expect(dialog(page)).toBeHidden();
  await page.reload();
  await expect(row(page, "Keep me")).toBeVisible();
});
