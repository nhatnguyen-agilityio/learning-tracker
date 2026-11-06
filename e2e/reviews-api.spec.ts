import { expect, type Page, test } from "@playwright/test";
import postgres from "postgres";
import { addResource } from "./resources";
import { signInNewUser } from "./sign-in";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const sql = postgres(databaseUrl);

test.afterAll(async () => {
  await sql.end();
});

/** Adds a card through the app and reads its id, which the UI doesn't show. */
async function addCard(page: Page) {
  const front = `Question ${crypto.randomUUID()}`;
  await page.goto("/library");
  await addResource(page, "Reviewed guide");
  await page.getByRole("link", { name: /Reviewed guide/ }).click();
  await page.getByRole("button", { name: "Add a card" }).click();
  await page.getByRole("dialog").getByLabel("Front").fill(front);
  await page.getByRole("dialog").getByLabel("Back").fill("Answer");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save card" })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();

  const [card] = await sql`select id from cards where front = ${front}`;
  return card.id as string;
}

const countReviews = async (cardId: string) => {
  const [{ total }] =
    await sql`select count(*)::int as total from reviews where card_id = ${cardId}`;
  return total as number;
};

const rate = (page: Page, cardId: string, key: string) =>
  page.request.post("/api/reviews", {
    data: { cardId, rating: "remembered", idempotencyKey: key },
  });

test.beforeEach(async ({ page }) => {
  await signInNewUser(page);
});

test("should save a rating once when it is resent", async ({ page }) => {
  const cardId = await addCard(page);

  const first = await rate(page, cardId, "key-1");
  const second = await rate(page, cardId, "key-1");

  expect(await first.json()).toEqual({ status: "saved" });
  expect(await second.json()).toEqual({ status: "duplicate" });
  expect(await countReviews(cardId)).toBe(1);
});

test("should undo the latest rating", async ({ page }) => {
  const cardId = await addCard(page);
  await rate(page, cardId, "key-1");

  const undo = await page.request.post("/api/reviews/undo", {
    data: { idempotencyKey: "key-1" },
  });

  expect(await undo.json()).toEqual({ status: "undone" });
  expect(await countReviews(cardId)).toBe(0);
});

test("should answer 409 when undoing an older rating", async ({ page }) => {
  const cardId = await addCard(page);
  await rate(page, cardId, "key-1");
  await rate(page, cardId, "key-2");

  const undo = await page.request.post("/api/reviews/undo", {
    data: { idempotencyKey: "key-1" },
  });

  expect(undo.status()).toBe(409);
});

test("should answer 400 when the input is wrong", async ({ page }) => {
  const cardId = await addCard(page);

  const badRating = await page.request.post("/api/reviews", {
    data: { cardId, rating: "easy", idempotencyKey: "key-1" },
  });
  const badId = await page.request.post("/api/reviews", {
    data: { cardId: "nope", rating: "forgot", idempotencyKey: "key-1" },
  });
  const notJson = await page.request.post("/api/reviews", {
    headers: { "content-type": "application/json" },
    data: "not json",
  });

  expect(badRating.status()).toBe(400);
  expect(badId.status()).toBe(400);
  expect(notJson.status()).toBe(400);
});

test("should answer 404 when the card doesn't exist", async ({ page }) => {
  const response = await rate(page, crypto.randomUUID(), "key-1");

  expect(response.status()).toBe(404);
});

test("should answer 401 when nobody is signed in", async ({
  page,
  context,
}) => {
  await context.clearCookies();

  const rating = await page.request.post("/api/reviews", {
    data: {},
    maxRedirects: 0,
  });
  const undo = await page.request.post("/api/reviews/undo", {
    data: {},
    maxRedirects: 0,
  });

  expect(rating.status()).toBe(401);
  expect(undo.status()).toBe(401);
});
