import { expect, type Page, test } from "@playwright/test";
import { callTool, connectMcp } from "./mcp-client";
import { signInNewUser } from "./sign-in";

const dialog = (page: Page) => page.getByRole("dialog");
const row = (page: Page, text: string) =>
  page.getByRole("listitem").filter({ hasText: text });

/** Retries, because a click before hydration does nothing. */
async function clickUntilGone(page: Page, button: string, text: string) {
  await expect(async () => {
    await row(page, text).getByRole("button", { name: button }).click();
    await expect(page.getByText(text)).toBeHidden({ timeout: 3000 });
  }).toPass();
}

async function propose(
  page: Page,
  baseURL: string | undefined,
  fronts: string[],
  title = "Proposed guide",
) {
  const client = await connectMcp(page, baseURL ?? "");
  const resource = await callTool(client, "add_resource", {
    url: `https://no-such-host.invalid/${crypto.randomUUID()}`,
  });
  await callTool(client, "create_cards", {
    resource_id: resource.id,
    cards: fronts.map((front) => ({ type: "qa", front, back: "The answer" })),
  });
  await client.close();
  return { ...resource, title };
}

test.beforeEach(async ({ page }) => {
  await signInNewUser(page);
});

test("should say so when nothing is pending", async ({ page }) => {
  await page.goto("/cards?tab=pending");

  await expect(
    page.getByText("No cards are waiting for review."),
  ).toBeVisible();
});

test("should approve a card and meet it in a review", async ({
  page,
  baseURL,
}) => {
  await propose(page, baseURL, ["Approve me"]);
  await page.goto("/");
  await expect(page.getByText("1 card from Claude is")).toBeVisible();
  await page.getByRole("link", { name: /1 card from Claude/ }).click();
  await expect(page).toHaveURL(/tab=pending/);
  await expect(page.getByText("The answer")).toBeVisible();

  await clickUntilGone(page, "Approve", "Approve me");

  await page.goto("/review");
  await expect(page.getByText("Approve me").first()).toBeVisible();
  await page.goto("/cards");
  await expect(row(page, "Approve me")).toContainText("New");
});

test("should approve all cards of a resource", async ({ page, baseURL }) => {
  await propose(page, baseURL, ["First", "Second"]);
  await page.goto("/cards?tab=pending");

  await expect(async () => {
    await page.getByRole("button", { name: "Approve all" }).click();
    await expect(
      page.getByText("No cards are waiting for review."),
    ).toBeVisible({ timeout: 3000 });
  }).toPass();

  await page.goto("/cards");
  await expect(page.getByText("2 cards", { exact: true })).toBeVisible();
});

test("should edit a pending card and keep it pending", async ({
  page,
  baseURL,
}) => {
  await propose(page, baseURL, ["Rough front"]);
  await page.goto("/cards?tab=pending");

  await expect(async () => {
    await row(page, "Rough front")
      .getByRole("button", { name: "Edit" })
      .click();
    await expect(dialog(page).getByLabel("Back")).toHaveValue("The answer", {
      timeout: 1000,
    });
  }).toPass();
  await dialog(page).getByLabel("Front").fill("Better front");
  await dialog(page).getByRole("button", { name: "Save card" }).click();

  await expect(row(page, "Better front")).toBeVisible();
  await expect(
    row(page, "Better front").getByRole("button", { name: "Approve" }),
  ).toBeVisible();
});

test("should delete a pending card", async ({ page, baseURL }) => {
  await propose(page, baseURL, ["Unwanted"]);
  await page.goto("/cards?tab=pending");

  await expect(async () => {
    await row(page, "Unwanted").getByRole("button", { name: "Delete" }).click();
    await expect(dialog(page)).toBeVisible({ timeout: 1000 });
  }).toPass();
  await dialog(page).getByRole("button", { name: "Delete card" }).click();

  await expect(
    page.getByText("No cards are waiting for review."),
  ).toBeVisible();
});

test("should label a pending card on the resource page", async ({
  page,
  baseURL,
}) => {
  const resource = await propose(page, baseURL, ["Labelled"]);

  await page.goto(`/library/${resource.id}`);

  await expect(row(page, "Labelled")).toContainText("Pending review");
});
