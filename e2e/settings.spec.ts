import { expect, type Page, test } from "@playwright/test";
import postgres from "postgres";
import { addResource } from "./resources";
import { signIn, signInNewUser } from "./sign-in";

const sql = postgres(
  process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
);

test.afterAll(async () => {
  await sql.end();
});

const dialog = (page: Page) => page.getByRole("dialog");
const perDay = (page: Page) => page.getByLabel("New cards per day");

async function addCards(page: Page, title: string, fronts: string[]) {
  await page.goto("/library");
  await addResource(page, title);
  await page.getByRole("link", { name: new RegExp(title) }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  for (const front of fronts) {
    await page.getByRole("button", { name: "Add a card" }).click();
    await dialog(page).getByLabel("Front").fill(front);
    await dialog(page).getByLabel("Back").fill("Answer");
    await dialog(page).getByRole("button", { name: "Save card" }).click();
    await expect(dialog(page)).toBeHidden();
  }
}

test("should use the new daily limit on Today", async ({ page }) => {
  await signInNewUser(page);
  await addCards(page, "Limited guide", ["One", "Two", "Three"]);
  await page.goto("/settings");

  await perDay(page).fill("1");
  await perDay(page).press("Enter");
  await expect(page.getByText("Saved")).toBeVisible();
  await page.goto("/");

  await expect(page.getByText("1", { exact: true })).toBeVisible();
  await expect(page.getByText("card due")).toBeVisible();

  await page.goto("/settings");
  await expect(perDay(page)).toHaveValue("1");
});

test("should refuse a number outside the limit", async ({ page }) => {
  await signInNewUser(page);
  await page.goto("/settings");

  await perDay(page).fill("101");
  await perDay(page).blur();

  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "from 0 to 100",
  );
  await page.reload();
  await expect(perDay(page)).toHaveValue("20");
});

test("should keep a new time zone after reloading", async ({ page }) => {
  await signInNewUser(page);
  await page.goto("/settings");
  const select = page.getByLabel("Time zone");

  await expect(async () => {
    await select.selectOption("Asia/Tokyo");
    await expect(page.getByText("Saved")).toBeVisible({ timeout: 500 });
  }).toPass();
  await page.reload();

  await expect(select).toHaveValue("Asia/Tokyo");
});

test("should save the language to the account", async ({ page }) => {
  const title = `Language guide ${crypto.randomUUID()}`;
  await signInNewUser(page);
  await page.goto("/library");
  await addResource(page, title);
  await page.goto("/settings");

  await page.getByRole("button", { name: "Tiếng Việt" }).click();

  await expect(page.getByRole("heading", { name: "Cài đặt" })).toBeVisible();
  const [settings] = await sql`
    select s.locale
    from user_settings s join resources r on r.user_id = s.user_id
    where r.title = ${title}`;
  expect(settings.locale).toBe("vi");
});

test("should sign out and keep the data", async ({ page }) => {
  const title = `Kept guide ${crypto.randomUUID()}`;
  await signIn(page, "b");
  await page.goto("/library");
  await addResource(page, title);
  await page.goto("/settings");

  await page.getByRole("button", { name: "Sign out" }).click();

  await expect(page).toHaveURL(/\/sign-in/);
  await page.goto("/library");
  await expect(page).toHaveURL(/\/sign-in/);

  await signIn(page, "b");
  await page.goto("/library");
  await expect(
    page.getByRole("link", { name: new RegExp(title) }),
  ).toBeVisible();
});
