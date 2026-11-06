import { expect, type Page, test } from "@playwright/test";
import postgres from "postgres";
import { addResource } from "./resources";
import { signInNewUser } from "./sign-in";

const sql = postgres(
  process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
);

test.afterAll(async () => {
  await sql.end();
});

const dialog = (page: Page) => page.getByRole("dialog");
const confirmButton = (page: Page) =>
  dialog(page).getByRole("button", { name: "Delete my account" });

async function openDialog(page: Page) {
  await page.goto("/settings");
  await page.getByRole("button", { name: "Delete account" }).click();
  await expect(dialog(page)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await signInNewUser(page);
});

test("should delete the account and everything in it", async ({ page }) => {
  const title = `Deleted guide ${crypto.randomUUID()}`;
  await page.goto("/library");
  await addResource(page, title);
  const [{ user_id: userId }] =
    await sql`select user_id from resources where title = ${title}`;
  await openDialog(page);

  await dialog(page).getByLabel("Type DELETE to confirm").fill("DELETE");
  await confirmButton(page).click();

  await expect(page).toHaveURL(/\/sign-in/);
  await page.goto("/library");
  await expect(page).toHaveURL(/\/sign-in/);
  expect(
    await sql`select id from auth.users where id = ${userId}`,
  ).toHaveLength(0);
  expect(
    await sql`select id from resources where user_id = ${userId}`,
  ).toHaveLength(0);
});

test("should need the word before deleting", async ({ page }) => {
  await openDialog(page);

  await expect(confirmButton(page)).toBeDisabled();
  await dialog(page).getByLabel("Type DELETE to confirm").fill("delete");

  await expect(confirmButton(page)).toBeDisabled();
});

test("should keep the account when cancelling", async ({ page }) => {
  await openDialog(page);

  await dialog(page).getByRole("button", { name: "Cancel" }).click();

  await expect(dialog(page)).toBeHidden();
  await page.reload();
  await expect(page).toHaveURL(/\/settings$/);
});

test("should clear the typed word when reopening", async ({ page }) => {
  await openDialog(page);
  await dialog(page).getByLabel("Type DELETE to confirm").fill("DELETE");
  await dialog(page).getByRole("button", { name: "Cancel" }).click();

  await page.getByRole("button", { name: "Delete account" }).click();

  await expect(confirmButton(page)).toBeDisabled();
});
