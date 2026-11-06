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
const remembered = (page: Page) =>
  page.getByRole("button", { name: /^Remembered/ });

async function openResource(page: Page, title: string) {
  await page.goto("/library");
  await addResource(page, title);
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

async function flip(page: Page) {
  await expect(async () => {
    await page.keyboard.press("Space");
    await expect(remembered(page)).toBeVisible({ timeout: 200 });
  }).toPass();
}

async function seedDueCards(title: string, total: number) {
  const rows = await sql`
    insert into cards (user_id, resource_id, front, back, status)
    select user_id, id, 'Seeded ' || n, 'Answer', 'active'
    from resources, generate_series(1, ${total}::int) as n
    where title = ${title}
    returning id, user_id`;
  for (const row of rows) {
    await sql`
      insert into card_schedules (card_id, user_id, due, state)
      values (${row.id}, ${row.user_id}, now() - interval '1 day', 2)`;
  }
}

test.beforeEach(async ({ page }) => {
  await signInNewUser(page);
});

test("should show the results when no cards are left", async ({ page }) => {
  await openResource(page, "Summed guide");
  await addCard(page, "Forgotten card");
  await addCard(page, "Known card");
  await page.goto("/review");

  await flip(page);
  await page.keyboard.press("1");
  await flip(page);
  await page.keyboard.press("3");
  await flip(page);
  await page.keyboard.press("3");

  await expect(
    page.getByRole("heading", { name: "Session complete" }),
  ).toBeVisible();
  await expect(page.getByText("cards reviewed")).toBeVisible();
  await expect(page.getByText("50%")).toBeVisible();
  await expect(page.getByText("Forgot 1")).toBeVisible();
  await expect(page.getByText("Remembered 1")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Keep reviewing" }),
  ).toBeHidden();
});

test("should show a streak of 1 after the first review", async ({ page }) => {
  await openResource(page, "Streak guide");
  await addCard(page, "First review");
  await page.goto("/review");
  await flip(page);
  await page.keyboard.press("3");

  await expect(page.getByText("day streak").locator("..")).toContainText("1");
});

test("should go back to the card when undoing from the summary", async ({
  page,
}) => {
  await openResource(page, "Undo guide");
  await addCard(page, "Last card");
  await page.goto("/review");
  await flip(page);
  await page.keyboard.press("3");
  await expect(
    page.getByRole("heading", { name: "Session complete" }),
  ).toBeVisible();

  await page.keyboard.press("z");

  await expect(page.getByText("1 card left")).toBeVisible();
  await expect(page.getByText("Last card").first()).toBeVisible();
});

test("should offer the next batch after 50 cards", async ({ page }) => {
  test.setTimeout(120_000);
  const title = `Batch guide ${crypto.randomUUID()}`;
  await openResource(page, title);
  await seedDueCards(title, 51);
  await page.goto("/review");
  await expect(page.getByText("50 cards left")).toBeVisible();

  await flip(page);
  await page.keyboard.press("3");
  for (let left = 49; left > 0; left -= 1) {
    await page.keyboard.press("Space");
    await page.keyboard.press("3");
  }

  await expect(
    page.getByRole("heading", { name: "Batch complete" }),
  ).toBeVisible();
  await expect(page.getByText("1 card is still due.")).toBeVisible();

  const keep = page.getByRole("button", { name: "Keep reviewing" });
  await expect(keep).toBeEnabled({ timeout: 30_000 });
  await keep.click();

  await expect(page.getByText("1 card left")).toBeVisible();

  await flip(page);
  await page.keyboard.press("3");

  await expect(
    page.getByRole("heading", { name: "Session complete" }),
  ).toBeVisible();
  await expect(page.getByText("51", { exact: true })).toBeVisible();
});
