import { expect, type Page, test } from "@playwright/test";
import { addResource } from "./resources";
import { signInNewUser } from "./sign-in";

const editor = (page: Page) => page.getByRole("textbox", { name: "Note" });

async function addNote(page: Page, text: string) {
  await page.getByRole("button", { name: "Add a note" }).click();
  await editor(page).fill(text);
  await expect(page.getByRole("article").getByRole("status")).toHaveText(
    "Saved",
  );
}

test.beforeEach(async ({ page }) => {
  await signInNewUser(page);
  await page.goto("/library");
  await addResource(page, "Noted guide");
  await page.getByRole("link", { name: /Noted guide/ }).click();
  await expect(
    page.getByRole("heading", { name: "Noted guide" }),
  ).toBeVisible();
});

test("should show the saved state after typing", async ({ page }) => {
  await addNote(page, "Remember this");

  await expect(page.getByRole("article").getByRole("status")).toHaveText(
    "Saved",
  );
});

test("should keep a note after reloading", async ({ page }) => {
  await addNote(page, "## Kept heading");

  await page.reload();

  await expect(
    page.getByRole("heading", { name: "Kept heading" }),
  ).toBeVisible();
});

test("should keep each note separate", async ({ page }) => {
  await addNote(page, "First note");
  await page.getByRole("button", { name: "Add a note" }).click();
  await expect(editor(page)).toHaveCount(2);
  await editor(page).last().fill("Second note");
  await expect(page.getByRole("article").getByRole("status").last()).toHaveText(
    "Saved",
  );

  await page.reload();

  await expect(page.getByText("First note")).toBeVisible();
  await expect(page.getByText("Second note")).toBeVisible();
});

test("should show an error and keep the text when the note is too long", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Add a note" }).click();
  const tooLong = "a".repeat(100 * 1024 + 1);

  await editor(page).fill(tooLong);

  await expect(page.getByRole("article").getByRole("alert")).toContainText(
    "100 KB limit",
  );
  await expect(editor(page)).toHaveValue(tooLong);
});

test("should delete a note after confirming", async ({ page }) => {
  await addNote(page, "Delete me");

  await page.getByRole("button", { name: "Delete note" }).click();
  await expect(page.getByText("Delete me")).toBeVisible();
  await page.getByRole("button", { name: "Delete", exact: true }).click();

  await expect(editor(page)).toBeHidden();
  await page.reload();
  await expect(page.getByText("Delete me")).toBeHidden();
});

test("should not run HTML in a note", async ({ page }) => {
  await addNote(page, `<img src=x onerror="window.noteHacked = true">`);

  await page.getByRole("button", { name: "Preview" }).click();

  await expect(page.getByRole("article").locator("img")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => (window as unknown as { noteHacked?: boolean }).noteHacked,
    ),
  ).toBeUndefined();
});

test("should keep only http and https links in a note", async ({ page }) => {
  await addNote(
    page,
    "[safe](https://example.com) and [unsafe](javascript:alert(1))",
  );

  await page.getByRole("button", { name: "Preview" }).click();

  await expect(
    page.getByRole("link", { name: "safe", exact: true }),
  ).toHaveAttribute("href", "https://example.com");
  await expect(page.getByText("unsafe")).not.toHaveAttribute("href");
});

test("should show the latest text after leaving and coming back", async ({
  page,
}) => {
  await addNote(page, "Back again");

  await page.getByRole("link", { name: "Library" }).first().click();
  await page
    .getByRole("link", { name: /Noted guide/ })
    .filter({ visible: true })
    .click();
  await page
    .getByRole("button", { name: "Preview" })
    .filter({ visible: true })
    .click();

  await expect(
    page.getByText("Back again").filter({ visible: true }),
  ).toBeVisible();
});

test("should find a resource by its note", async ({ page }) => {
  await addNote(page, "Ghi chú về đệ quy");

  await page.goto("/library?q=de%20quy");

  await expect(page.getByRole("link", { name: /Noted guide/ })).toBeVisible();
});
