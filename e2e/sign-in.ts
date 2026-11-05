import { expect, type Page } from "@playwright/test";

/** Signs in as a seeded local user. Needs `pnpm db:start`. */
export async function signIn(page: Page, user: "a" | "b" = "a") {
  await page.goto(`/test-sign-in?user=${user}`);
  await expect(page).toHaveURL("/");
}
