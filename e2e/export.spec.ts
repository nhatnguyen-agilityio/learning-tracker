import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { addResource } from "./resources";
import { signInNewUser } from "./sign-in";

test("should download the user's data from Settings", async ({ page }) => {
  await signInNewUser(page);
  await page.goto("/library");
  await addResource(page, "Exported guide");
  await page.goto("/settings");

  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export data as JSON" }).click();
  const file = await download;

  expect(file.suggestedFilename()).toMatch(
    /^learning-tracker-export-\d{4}-\d{2}-\d{2}\.json$/,
  );
  const data = JSON.parse(await readFile(await file.path(), "utf8"));
  expect(data.version).toBe(1);
  expect(data.resources).toHaveLength(1);
  expect(data.resources[0].title).toBe("Exported guide");
});

test("should answer 401 when nobody is signed in", async ({ page }) => {
  const response = await page.request.get("/api/export", { maxRedirects: 0 });

  expect(response.status()).toBe(401);
});
