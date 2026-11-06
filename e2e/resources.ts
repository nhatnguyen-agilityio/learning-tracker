import { expect, type Page } from "@playwright/test";

/** Adds a resource from Library, with a link that gives no metadata. */
export async function addResource(page: Page, title: string, topic?: string) {
  await page.getByRole("button", { name: "Add a source" }).click();
  const link = page.getByLabel("Paste a link");
  await link.fill(`https://no-such-host.invalid/${crypto.randomUUID()}`);
  await link.press("Enter");
  await page.getByLabel("Title").fill(title);
  if (topic) {
    await page.getByRole("combobox").fill(topic);
    await page.getByRole("button", { name: `Create "${topic}"` }).click();
  }
  await page.getByRole("dialog").getByRole("button", { name: "Done" }).click();
  await page.getByRole("button", { name: "Save source" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
}
