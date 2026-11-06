import { expect, type Page, test } from "@playwright/test";
import { addResource } from "./resources";
import { signInNewUser } from "./sign-in";

const slider = (page: Page) => page.getByLabel("Progress");
const statusButton = (page: Page, name: string) =>
  page
    .getByRole("group", { name: "Status" })
    .getByRole("button", { name, exact: true });

async function setProgress(page: Page, value: string) {
  await slider(page).fill(value);
  await expect(page.getByRole("status").first()).toHaveText("Saved");
}

test.beforeEach(async ({ page }) => {
  await signInNewUser(page);
  await page.goto("/library");
  await addResource(page, "Tracked guide", undefined, "Want to learn");
  await page.getByRole("link", { name: /Tracked guide/ }).click();
  await expect(
    page.getByRole("heading", { name: "Tracked guide" }),
  ).toBeVisible();
});

test("should move to Learning when progress goes above 0", async ({ page }) => {
  await expect(statusButton(page, "Want to learn")).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await setProgress(page, "50");

  await expect(statusButton(page, "Learning")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("should keep progress and status after reloading", async ({ page }) => {
  await setProgress(page, "35");

  await page.reload();

  await expect(slider(page)).toHaveValue("35");
  await expect(statusButton(page, "Learning")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("should mark as Done when accepting the suggestion at 100%", async ({
  page,
}) => {
  await setProgress(page, "100");

  await page.getByRole("button", { name: "Mark as Done" }).click();

  await expect(statusButton(page, "Done")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "Mark as Done" })).toBeHidden();
});

test("should hide the suggestion when choosing Not now", async ({ page }) => {
  await setProgress(page, "100");

  await page.getByRole("button", { name: "Not now" }).click();

  await expect(page.getByRole("button", { name: "Mark as Done" })).toBeHidden();
  await expect(statusButton(page, "Learning")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("should keep the percentage when changing the status to Done", async ({
  page,
}) => {
  await setProgress(page, "40");

  await statusButton(page, "Done").click();
  await expect(page.getByRole("status").first()).toHaveText("Saved");
  await page.reload();

  await expect(slider(page)).toHaveValue("40");
  await expect(statusButton(page, "Done")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("should show the new progress and status on Library", async ({ page }) => {
  await setProgress(page, "60");

  await page.getByRole("link", { name: "Library" }).first().click();

  const row = page
    .getByRole("link", { name: /Tracked guide/ })
    .filter({ visible: true });
  await expect(row).toContainText("60%");
  await expect(row).toContainText("Learning");
});
