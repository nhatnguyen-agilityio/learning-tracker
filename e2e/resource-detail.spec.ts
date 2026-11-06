import { expect, type Page, test } from "@playwright/test";
import { addResource } from "./resources";
import { signIn, signInNewUser } from "./sign-in";

async function openDetail(page: Page, title: string) {
  await page.getByRole("link", { name: new RegExp(title) }).click();
  await expect(page).toHaveURL(/\/library\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await signInNewUser(page);
  await page.goto("/library");
});

test("should open the detail page from Library", async ({ page }) => {
  await addResource(page, "Detail guide", "Rust");

  await openDetail(page, "Detail guide");

  await expect(page.getByText("Rust").filter({ visible: true })).toBeVisible();
});

test("should link to the original page in a new tab", async ({ page }) => {
  await addResource(page, "Linked guide");
  await openDetail(page, "Linked guide");

  const link = page.getByRole("link", { name: "Open original link" });

  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  await expect(link).toHaveAttribute("href", /^https:\/\/no-such-host/);
});

test("should edit the title and topics", async ({ page }) => {
  await addResource(page, "Before edit");
  await openDetail(page, "Before edit");

  await page.getByRole("button", { name: "Edit" }).click();
  await expect(page.getByLabel("Paste a link")).toBeDisabled();
  await page.getByLabel("Title").fill("After edit");
  await page.getByRole("combobox").fill("Go");
  await page.getByRole("button", { name: 'Create "Go"' }).click();
  await expect(page.getByRole("button", { name: "Remove Go" })).toBeVisible();
  await page.getByRole("button", { name: "Save source" }).click();

  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByRole("heading", { name: "After edit" })).toBeVisible();
  await expect(page.getByText("Go", { exact: true })).toBeVisible();
});

test("should open the existing resource from the duplicate warning", async ({
  page,
}) => {
  const link = `https://no-such-host.invalid/${crypto.randomUUID()}`;
  await page.getByRole("button", { name: "Add a source" }).click();
  await page.getByLabel("Paste a link").fill(link);
  await page.getByLabel("Paste a link").press("Enter");
  await page.getByLabel("Title").fill("Original");
  await page.getByRole("button", { name: "Save source" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  await page.getByRole("button", { name: "Add a source" }).click();
  await page.getByLabel("Paste a link").fill(link);
  await page.getByLabel("Paste a link").press("Enter");
  await page.getByRole("link", { name: "Open existing source" }).click();

  await expect(page.getByRole("heading", { name: "Original" })).toBeVisible();
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("should show not found when the id is not valid", async ({ page }) => {
  await page.goto("/library/not-a-uuid");

  await expect(page.getByText("This source doesn't exist")).toBeVisible();
});

test("should show not found when the resource belongs to another user", async ({
  page,
  browser,
}) => {
  await addResource(page, "Private guide");
  await openDetail(page, "Private guide");
  const url = page.url();

  const otherContext = await browser.newContext({
    baseURL: new URL(url).origin,
  });
  const other = await otherContext.newPage();
  await signIn(other, "b");
  await other.goto(url);

  await expect(other.getByText("This source doesn't exist")).toBeVisible();
  await expect(other.getByText("Private guide")).toBeHidden();
  await otherContext.close();
});
