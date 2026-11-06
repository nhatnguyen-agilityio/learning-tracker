import { expect, test } from "@playwright/test";
import { signInNewUser } from "./sign-in";

test("should open Terms from the sign-in page when signed out", async ({
  page,
}) => {
  await page.goto("/sign-in");

  await page.getByRole("link", { name: "Terms" }).click();

  await expect(page).toHaveURL(/\/terms$/);
  await expect(
    page.getByRole("heading", { name: "Terms of use" }),
  ).toBeVisible();
});

test("should open Privacy from the sign-in page when signed out", async ({
  page,
}) => {
  await page.goto("/sign-in");

  await page.getByRole("link", { name: "Privacy" }).click();

  await expect(page).toHaveURL(/\/privacy$/);
  await expect(
    page.getByRole("heading", { name: "Privacy policy" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "nguyenvanducnhat@gmail.com" }),
  ).toBeVisible();
});

test("should go back to the previous screen", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("link", { name: "Terms" }).click();
  await expect(page).toHaveURL(/\/terms$/);

  await page.getByRole("button", { name: "Back" }).click();

  await expect(page).toHaveURL(/\/sign-in$/);
});

test("should switch between the two pages", async ({ page }) => {
  await page.goto("/terms");

  await page
    .getByRole("navigation", { name: "Legal pages" })
    .getByRole("link", { name: "Privacy" })
    .click();

  await expect(page).toHaveURL(/\/privacy$/);
});

test("should open both pages from Settings", async ({ page }) => {
  await signInNewUser(page);
  await page.goto("/settings");

  await page.getByRole("link", { name: "Terms" }).click();
  await expect(page).toHaveURL(/\/terms$/);

  await page.getByRole("button", { name: "Back" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await page.getByRole("link", { name: "Privacy" }).click();

  await expect(page).toHaveURL(/\/privacy$/);
});

test.describe("when the browser prefers Vietnamese", () => {
  test.use({ locale: "vi-VN" });

  test("should show the pages in Vietnamese", async ({ page }) => {
    await page.goto("/privacy");

    await expect(
      page.getByRole("heading", { name: "Chính sách quyền riêng tư" }),
    ).toBeVisible();
  });
});
