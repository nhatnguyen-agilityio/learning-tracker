import { expect, test } from "@playwright/test";
import { addResource } from "./resources";
import { signInNewUser } from "./sign-in";

test.beforeEach(async ({ page }) => {
  await signInNewUser(page);
  await page.goto("/library");
  await addResource(page, "Old guide");
  await page.getByRole("link", { name: /Old guide/ }).click();
  await expect(page.getByRole("heading", { name: "Old guide" })).toBeVisible();
});

test("should delete the resource and return to Library", async ({ page }) => {
  await page.getByRole("button", { name: "Delete source" }).click();
  await expect(page.getByRole("dialog")).toContainText("no notes or cards");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete source" })
    .click();

  await expect(page).toHaveURL(/\/library$/);
  await expect(
    page.getByRole("link", { name: /Old guide/ }).filter({ visible: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("link", { name: /Old guide/ })).toHaveCount(0);
});

test("should tell how many notes go when the resource has notes", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Add a note" }).click();
  await expect(page.getByRole("textbox", { name: "Note" })).toBeVisible();

  await page.getByRole("button", { name: "Delete source" }).click();

  await expect(page.getByRole("dialog")).toContainText(
    "1 note will be deleted permanently",
  );
  await expect(
    page.getByRole("button", { name: "Delete source and notes" }),
  ).toBeVisible();
});

test("should keep the resource when cancelling", async ({ page }) => {
  await page.getByRole("button", { name: "Delete source" }).click();
  await page.getByRole("button", { name: "Cancel" }).click();

  await expect(page.getByRole("dialog")).toBeHidden();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Old guide" })).toBeVisible();
});
