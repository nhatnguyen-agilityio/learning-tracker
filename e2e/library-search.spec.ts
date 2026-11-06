import { expect, type Page, test } from "@playwright/test";
import { addResource } from "./resources";
import { signInNewUser } from "./sign-in";

const search = (page: Page) => page.getByRole("searchbox", { name: "Search" });
const row = (page: Page, title: string) =>
  page.getByRole("link", { name: new RegExp(title) });

test.beforeEach(async ({ page }) => {
  await signInNewUser(page);
  await page.goto("/library");
  await addResource(page, "Lập trình Rust");
  await addResource(page, "Plain guide");
});

test("should find a Vietnamese title when typing without accents", async ({
  page,
}) => {
  await search(page).fill("lap trinh");

  await expect(row(page, "Plain guide")).toBeHidden();
  await expect(row(page, "Lập trình Rust")).toBeVisible();
});

test("should keep filters in the URL", async ({ page }) => {
  await search(page).fill("plain");
  await expect(page).toHaveURL(/q=plain/);

  await page.getByRole("button", { name: "Done", exact: true }).click();

  await expect(page).toHaveURL(/q=plain.*status=done|status=done.*q=plain/);
});

test("should keep filters after reloading", async ({ page }) => {
  await search(page).fill("plain");
  await expect(row(page, "Lập trình Rust")).toBeHidden();

  await page.reload();

  await expect(search(page)).toHaveValue("plain");
  await expect(row(page, "Lập trình Rust")).toBeHidden();
  await expect(row(page, "Plain guide")).toBeVisible();
});

test("should show no results and clear filters", async ({ page }) => {
  await search(page).fill("nothing matches this");

  await expect(page.getByText("No sources match.")).toBeVisible();

  await page.getByRole("link", { name: "Clear filters" }).click();

  await expect(row(page, "Plain guide")).toBeVisible();
  await expect(page).toHaveURL("/library");
  await expect(search(page)).toHaveValue("");
});
