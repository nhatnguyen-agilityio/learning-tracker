import { expect, type Page, test } from "@playwright/test";
import { addResource } from "./resources";
import { signInNewUser } from "./sign-in";

const dialog = (page: Page) => page.getByRole("dialog");
const row = (page: Page, name: string) =>
  page.getByRole("listitem").filter({ hasText: name });

async function addTopic(page: Page, title: string, topic: string) {
  await page.goto("/library");
  await addResource(page, title, topic);
}

async function openEdit(page: Page, name: string) {
  await page.goto("/settings");
  await row(page, name).getByRole("button", { name: "Edit" }).click();
  await expect(page.getByLabel("Topic name")).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await signInNewUser(page);
});

test("should say so when there are no topics", async ({ page }) => {
  await page.goto("/settings");

  await expect(page.getByText("No topics yet.")).toBeVisible();
});

test("should show a renamed topic in Library", async ({ page }) => {
  await addTopic(page, "Renamed guide", "Old name");
  await openEdit(page, "Old name");

  await page.getByLabel("Topic name").fill("New name");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(row(page, "New name")).toBeVisible();

  await page.goto("/library");

  const resource = page.getByRole("link", { name: /Renamed guide/ });
  await expect(resource).toContainText("New name");
  await expect(resource).not.toContainText("Old name");
});

test("should keep a new color after reloading", async ({ page }) => {
  await addTopic(page, "Colored guide", "Paint");
  await openEdit(page, "Paint");

  await page.getByRole("button", { name: "Color 5" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByLabel("Topic name")).toBeHidden();

  await page.reload();
  await row(page, "Paint").getByRole("button", { name: "Edit" }).click();

  await expect(page.getByRole("button", { name: "Color 5" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("should refuse a name another topic has", async ({ page }) => {
  await addTopic(page, "First guide", "Taken");
  await addTopic(page, "Second guide", "Other");
  await openEdit(page, "Other");

  await page.getByLabel("Topic name").fill("taken");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "already exists",
  );
});

test("should restore the name when cancelling an edit", async ({ page }) => {
  await addTopic(page, "Cancelled guide", "Stays");
  await openEdit(page, "Stays");

  await page.getByLabel("Topic name").fill("Changed");
  await page.getByRole("button", { name: "Cancel" }).click();

  await expect(row(page, "Stays")).toBeVisible();
});

test("should delete a topic and keep its resource", async ({ page }) => {
  await addTopic(page, "Kept guide", "Removed");
  await page.goto("/settings");

  await row(page, "Removed").getByRole("button", { name: "Delete" }).click();
  await expect(dialog(page)).toContainText("1 source");
  await dialog(page).getByRole("button", { name: "Delete topic" }).click();

  await expect(page.getByText("No topics yet.")).toBeVisible();
  await page.goto("/library");
  const resource = page.getByRole("link", { name: /Kept guide/ });
  await expect(resource).toBeVisible();
  await expect(resource).not.toContainText("Removed");
});

test("should keep the topic when cancelling the delete", async ({ page }) => {
  await addTopic(page, "Safe guide", "Safe");
  await page.goto("/settings");

  await row(page, "Safe").getByRole("button", { name: "Delete" }).click();
  await dialog(page).getByRole("button", { name: "Cancel" }).click();

  await expect(dialog(page)).toBeHidden();
  await page.reload();
  await expect(row(page, "Safe")).toBeVisible();
});
