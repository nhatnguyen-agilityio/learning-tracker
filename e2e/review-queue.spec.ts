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

async function addCards(page: Page, fronts: string[]) {
  await page.goto("/library");
  await addResource(page, "Queued guide");
  await page.getByRole("link", { name: /Queued guide/ }).click();
  await expect(
    page.getByRole("heading", { name: "Queued guide" }),
  ).toBeVisible();
  for (const front of fronts) {
    await page.getByRole("button", { name: "Add a card" }).click();
    await dialog(page).getByLabel("Front").fill(front);
    await dialog(page).getByLabel("Back").fill("Answer");
    await dialog(page).getByRole("button", { name: "Save card" }).click();
    await expect(dialog(page)).toBeHidden();
  }
}

async function flip(page: Page) {
  await expect(async () => {
    await page.keyboard.press("Space");
    await expect(remembered(page)).toBeVisible({ timeout: 200 });
  }).toPass();
}

const countReviews = async (front: string) => {
  const [{ total }] = await sql`
    select count(*)::int as total
    from reviews join cards on cards.id = reviews.card_id
    where cards.front = ${front}`;
  return total as number;
};

test.beforeEach(async ({ page }) => {
  await signInNewUser(page);
});

test("should save a rating once after a network error", async ({ page }) => {
  const front = `Retry ${crypto.randomUUID()}`;
  await addCards(page, [front]);
  await page.goto("/review");
  await page.route("**/api/reviews", (route) => route.abort());

  await flip(page);
  await page.keyboard.press("3");

  await expect(
    page.getByRole("heading", { name: "Session complete" }),
  ).toBeVisible();
  await expect(page.getByText(/Sending 1 rating/)).toBeVisible();
  expect(await countReviews(front)).toBe(0);

  await page.unroute("**/api/reviews");

  await expect.poll(() => countReviews(front), { timeout: 15000 }).toBe(1);
  await expect(page.getByText(/Sending 1 rating/)).toBeHidden();
});

test("should send a waiting rating after reloading", async ({ page }) => {
  const front = `Reload ${crypto.randomUUID()}`;
  const other = `Other ${crypto.randomUUID()}`;
  await addCards(page, [front, other]);
  await page.goto("/review");
  await page.route("**/api/reviews", (route) => route.abort());

  await flip(page);
  await page.keyboard.press("3");
  await expect(page.getByText("1 card left")).toBeVisible();

  await page.unroute("**/api/reviews");
  await page.route("**/api/reviews", (route) => route.abort());
  await page.reload();
  await page.unroute("**/api/reviews");

  await expect.poll(() => countReviews(front), { timeout: 15000 }).toBe(1);
  await expect(page.getByText("1 card left")).toBeVisible();
  await expect(page.getByText(other).first()).toBeVisible();
});

test("should tell the user when the network is off", async ({
  page,
  context,
}) => {
  const front = `Offline ${crypto.randomUUID()}`;
  await addCards(page, [front]);
  await page.goto("/review");
  await flip(page);

  await context.setOffline(true);
  await page.keyboard.press("3");

  await expect(page.getByRole("status")).toContainText("Connection lost");

  await context.setOffline(false);

  await expect.poll(() => countReviews(front), { timeout: 15000 }).toBe(1);
});

test("should change cards in under 200 ms", async ({ page }) => {
  await addCards(page, ["Fast one", "Fast two"]);
  await page.goto("/review");
  await flip(page);

  const elapsed = await page.evaluate(async () => {
    const start = performance.now();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "3" }));
    while (!document.body.textContent?.includes("1 card left")) {
      await new Promise(requestAnimationFrame);
    }
    return performance.now() - start;
  });

  console.log(`Card change: ${elapsed.toFixed(1)} ms`);
  expect(elapsed).toBeLessThan(200);
});
