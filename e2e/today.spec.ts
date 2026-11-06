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

async function openNewResource(page: Page, title: string) {
  await page.goto("/library");
  await addResource(page, title, undefined, "Want to learn");
  await page.getByRole("link", { name: new RegExp(title) }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
}

async function addCard(page: Page, front: string) {
  await page.getByRole("button", { name: "Add a card" }).click();
  await dialog(page).getByLabel("Front").fill(front);
  await dialog(page).getByLabel("Back").fill("Answer");
  await dialog(page).getByRole("button", { name: "Save card" }).click();
  await expect(dialog(page)).toBeHidden();
}

test.beforeEach(async ({ page }) => {
  await signInNewUser(page);
});

test("should suggest the first resource to a new user", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Start with a learning source")).toBeVisible();
  await page
    .getByRole("button", { name: "Add your first learning source" })
    .click();

  await expect(dialog(page)).toBeVisible();
});

test("should say so when no cards are due", async ({ page }) => {
  await openNewResource(page, "Quiet guide");

  await page.goto("/");

  await expect(page.getByText("No cards due today")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Start reviewing" }),
  ).toBeHidden();
  await expect(page.getByText("Start with a learning source")).toBeHidden();
});

test("should start a review from Today and return", async ({ page }) => {
  await openNewResource(page, "Daily guide");
  await addCard(page, "Daily question");
  await page.goto("/");
  await expect(page.getByText("card due")).toBeVisible();

  await page.getByRole("link", { name: "Start reviewing" }).click();
  await expect(page).toHaveURL(/\/review$/);
  await expect(async () => {
    await page.keyboard.press("Space");
    await expect(page.getByRole("button", { name: /^Remembered/ })).toBeVisible(
      { timeout: 200 },
    );
  }).toPass();
  const saved = page.waitForResponse("**/api/reviews");
  await page.keyboard.press("3");
  await saved;
  await page.getByRole("link", { name: "Back to Today" }).click();

  await expect(page.getByText("All done for today")).toBeVisible();
  await expect(page.getByText("1-day streak")).toBeVisible();
});

test("should show resources in progress and open one", async ({ page }) => {
  await openNewResource(page, "Halfway guide");
  await page.getByLabel("Progress").fill("50");
  await expect(page.getByRole("status").first()).toHaveText("Saved");

  await page.goto("/");

  const row = page.getByRole("link", { name: /Halfway guide/ });
  await expect(row).toContainText("50%");
  await row.click();
  await expect(page).toHaveURL(/\/library\/[0-9a-f-]+$/);
});

test("should offer Library when nothing is in progress", async ({ page }) => {
  await openNewResource(page, "Waiting guide");

  await page.goto("/");

  await expect(page.getByText("No sources in progress yet.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Library" })).toBeVisible();
});

test("should explain a backlog", async ({ page }) => {
  const title = `Backlog guide ${crypto.randomUUID()}`;
  await openNewResource(page, title);
  const rows = await sql`
    insert into cards (user_id, resource_id, front, back, status)
    select user_id, id, 'Seeded ' || n, 'Answer', 'active'
    from resources, generate_series(1, 51) as n
    where title = ${title}
    returning id, user_id`;
  await sql`
    insert into card_schedules ${sql(
      rows.map((row) => ({
        card_id: row.id,
        user_id: row.user_id,
        due: new Date(Date.now() - 86_400_000),
        state: 2,
      })),
    )}`;

  await page.goto("/");

  await expect(
    page.getByText("You have a backlog after your break."),
  ).toBeVisible();
  await expect(page.getByText("51", { exact: true })).toBeVisible();
});
