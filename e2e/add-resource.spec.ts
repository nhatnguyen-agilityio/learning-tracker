import { expect, type Page, test } from "@playwright/test";
import { signIn } from "./sign-in";

function uniqueLink() {
  return `https://no-such-host.invalid/${crypto.randomUUID()}`;
}

async function openModal(page: Page) {
  await signIn(page, "b");
  await page.goto("/library");
  await page.getByRole("button", { name: "Add a source" }).click();
}

async function enterLink(page: Page, link: string) {
  await page.getByLabel("Paste a link").fill(link);
  await page.getByLabel("Paste a link").press("Enter");
}

async function addResource(page: Page, link: string, title: string) {
  await enterLink(page, link);
  await page.getByLabel("Title").fill(title);
  await page.getByRole("button", { name: "Save source" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
}

test("should add a resource when the link gives no metadata", async ({
  page,
}) => {
  await openModal(page);
  await enterLink(page, uniqueLink());

  await expect(page.getByText(/could not read this link/)).toBeVisible();
  await expect(
    page.getByRole("dialog").getByTestId("thumbnail-fallback"),
  ).toBeVisible();

  await page.getByLabel("Title").fill("A guide");
  await page.getByRole("button", { name: "Save source" }).click();

  await expect(page.getByRole("dialog")).toBeHidden();
});

test("should block saving when the title is empty", async ({ page }) => {
  await openModal(page);
  await enterLink(page, uniqueLink());
  await expect(page.getByLabel("Title")).toBeVisible();

  await page.getByRole("button", { name: "Save source" }).click();

  await expect(page.getByText("The title cannot be empty.")).toBeVisible();
});

test("should warn and link to the resource when the link is a duplicate", async ({
  page,
}) => {
  const link = uniqueLink();
  await openModal(page);
  await addResource(page, link, "Saved once");

  await page.getByRole("button", { name: "Add a source" }).click();
  await enterLink(page, `${link}/?utm_source=newsletter`);

  await expect(page.getByRole("alert")).toContainText(
    "already in your library",
  );
  await expect(page.getByRole("dialog").getByText("Saved once")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open existing source" }),
  ).toHaveAttribute("href", /^\/library\/[0-9a-f-]+$/);
  await expect(page.getByRole("button", { name: "Save source" })).toBeHidden();
});

test("should show an error when the link is invalid", async ({ page }) => {
  await openModal(page);

  await enterLink(page, "ftp://example.test");

  await expect(page.getByText(/must start with http or https/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Save source" })).toBeHidden();
});

test("should create a topic in place and keep it when saving", async ({
  page,
}) => {
  const topic = `Topic ${crypto.randomUUID().slice(0, 8)}`;
  await openModal(page);
  await enterLink(page, uniqueLink());

  await page.getByRole("combobox").fill(topic);
  await page.getByRole("button", { name: `Create "${topic}"` }).click();

  await expect(
    page.getByRole("button", { name: `Remove ${topic}` }),
  ).toBeVisible();

  await page.getByLabel("Title").fill("With a topic");
  await page.getByRole("button", { name: "Save source" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  await page.getByRole("button", { name: "Add a source" }).click();
  await enterLink(page, uniqueLink());
  await page.getByRole("combobox").click();

  await expect(page.getByRole("option", { name: topic })).toBeVisible();
});
