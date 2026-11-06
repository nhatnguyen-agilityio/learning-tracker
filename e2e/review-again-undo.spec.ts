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
const undoButton = (page: Page) => page.getByRole("button", { name: "Undo" });

async function addCards(page: Page, fronts: string[]) {
  await page.goto("/library");
  await addResource(page, "Undone guide");
  await page.getByRole("link", { name: /Undone guide/ }).click();
  await expect(
    page.getByRole("heading", { name: "Undone guide" }),
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

const readSchedule = async (front: string) => {
  const [row] = await sql`
    select s.due, s.stability, s.difficulty, s.learning_steps, s.reps,
           s.lapses, s.state, s.last_review
    from card_schedules s join cards c on c.id = s.card_id
    where c.front = ${front}`;
  return row;
};

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

test("should meet a forgotten card at the end of the session", async ({
  page,
}) => {
  const first = `Forgotten ${crypto.randomUUID()}`;
  const second = `Known ${crypto.randomUUID()}`;
  await addCards(page, [first, second]);
  await page.goto("/review");

  await flip(page);
  await page.keyboard.press("1");
  await expect(page.getByText("2 cards left")).toBeVisible();

  await flip(page);
  await page.keyboard.press("3");

  await expect(page.getByText("1 card left")).toBeVisible();
  await expect(page.getByText("Review again")).toBeVisible();
  await expect(page.getByText(first).first()).toBeVisible();

  await flip(page);
  await page.keyboard.press("3");

  await expect(page.getByText("No cards left for now.")).toBeVisible();
  await expect.poll(() => countReviews(first)).toBe(2);
});

test("should show the same card and keep the schedule after undo", async ({
  page,
}) => {
  const front = `Undo ${crypto.randomUUID()}`;
  await addCards(page, [front, `Next ${crypto.randomUUID()}`]);
  const before = await readSchedule(front);
  await page.goto("/review");

  await flip(page);
  const saved = page.waitForResponse("**/api/reviews");
  await page.keyboard.press("3");
  await saved;
  await expect(page.getByText("1 card left")).toBeVisible();

  const undone = page.waitForResponse("**/api/reviews/undo");
  await page.keyboard.press("z");

  expect((await undone).status()).toBe(200);
  await expect(page.getByText("2 cards left")).toBeVisible();
  await expect(page.getByText(front).first()).toBeVisible();
  await expect(remembered(page)).toBeHidden();
  await expect.poll(() => countReviews(front)).toBe(0);
  expect(await readSchedule(front)).toEqual(before);
});

test("should undo with the button on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const front = `Phone ${crypto.randomUUID()}`;
  await addCards(page, [front]);
  await page.goto("/review");
  await expect(undoButton(page)).toBeDisabled();

  await flip(page);
  await remembered(page).click();
  await expect(page.getByText("No cards left for now.")).toBeVisible();
  // The dev server's floating badge covers this corner at 375 px.
  await undoButton(page).dispatchEvent("click");

  await expect(page.getByText("1 card left")).toBeVisible();
  await expect(undoButton(page)).toBeDisabled();
  await expect.poll(() => countReviews(front)).toBe(0);
});

test("should undo a rating that is still in the queue", async ({ page }) => {
  const front = `Queued ${crypto.randomUUID()}`;
  await addCards(page, [front]);
  await page.goto("/review");
  await page.route("**/api/reviews", (route) => route.abort());

  await flip(page);
  await page.keyboard.press("3");
  await expect(page.getByText(/Sending 1 rating/)).toBeVisible();
  await page.keyboard.press("z");

  await expect(page.getByText("1 card left")).toBeVisible();
  await expect(page.getByText(/Sending/)).toBeHidden();

  await page.unroute("**/api/reviews");
  await page.reload();
  await expect(page.getByText("1 card left")).toBeVisible();
  expect(await countReviews(front)).toBe(0);
});

test("should show the offline banner while ratings wait", async ({
  page,
  context,
}) => {
  await addCards(page, [`Banner ${crypto.randomUUID()}`, "Second card"]);
  await page.goto("/review");
  await flip(page);

  await context.setOffline(true);
  await page.keyboard.press("3");

  await expect(page.getByRole("status")).toContainText("Connection lost");
  await context.setOffline(false);
});
