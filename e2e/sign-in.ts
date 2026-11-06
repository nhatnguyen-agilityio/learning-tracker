import { expect, type Page } from "@playwright/test";

/** Signs in as a seeded local user. Needs `pnpm db:start`. */
export async function signIn(page: Page, user: "a" | "b" = "a") {
  await page.goto(`/test-sign-in?user=${user}`);
  await expect(page).toHaveURL("/");
}

/** Signs in as a new throwaway user with no data. Needs `pnpm db:start`. */
export async function signInNewUser(page: Page) {
  await page.goto("/test-sign-in?user=new");
  await expect(page).toHaveURL("/");
}
