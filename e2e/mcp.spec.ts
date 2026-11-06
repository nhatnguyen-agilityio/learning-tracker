import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { expect, type Page, test } from "@playwright/test";
import postgres from "postgres";
import { signInNewUser } from "./sign-in";

const sql = postgres(
  process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
);

test.afterAll(async () => {
  await sql.end();
});

async function createToken(page: Page, name: string) {
  await page.goto("/settings");
  await page.getByLabel("New token name").fill(name);
  await expect(async () => {
    await page.getByRole("button", { name: "Create token" }).click();
    await expect(page.getByText(/^lt_/)).toBeVisible({ timeout: 2000 });
  }).toPass();
  return (await page.getByText(/^lt_/).textContent()) ?? "";
}

async function connect(baseURL: string, token: string) {
  const client = new Client({ name: "e2e", version: "1.0.0" });
  await client.connect(
    new StreamableHTTPClientTransport(new URL("/api/mcp", baseURL), {
      requestInit: { headers: { authorization: `Bearer ${token}` } },
    }),
  );
  return client;
}

const initialize = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "e2e", version: "1.0.0" },
  },
};

const post = (page: Page, authorization?: string) =>
  page.request.post("/api/mcp", {
    data: initialize,
    headers: {
      accept: "application/json, text/event-stream",
      ...(authorization ? { authorization } : {}),
    },
  });

test.beforeEach(async ({ page }) => {
  await signInNewUser(page);
});

test("should connect and list the tools", async ({ page, baseURL }) => {
  const token = await createToken(page, "MCP client");

  const client = await connect(baseURL ?? "", token);
  const { tools } = await client.listTools();
  await client.close();

  expect(tools.map((tool) => tool.name)).toContain("get_study_stats");
});

test("should answer with the token owner's data", async ({ page, baseURL }) => {
  const token = await createToken(page, "MCP stats");

  const client = await connect(baseURL ?? "", token);
  const result = await client.callTool({ name: "get_study_stats" });
  await client.close();

  expect(result.content).toEqual([
    {
      type: "text",
      text: JSON.stringify({
        streak: 0,
        dueCount: 0,
        recallRate: null,
        range: "30d",
      }),
    },
  ]);
});

test("should record when a token was used", async ({ page, baseURL }) => {
  const token = await createToken(page, "MCP used");
  const client = await connect(baseURL ?? "", token);
  await client.close();

  await page.reload();

  await expect(
    page.getByRole("listitem").filter({ hasText: "MCP used" }),
  ).toContainText("Last used");
});

test("should refuse a missing or wrong token", async ({ page }) => {
  const missing = await post(page);
  const wrong = await post(page, "Bearer lt_wrong");
  const malformed = await post(page, "Basic abc");

  expect(missing.status()).toBe(401);
  expect(wrong.status()).toBe(401);
  expect(malformed.status()).toBe(401);
  expect(await wrong.json()).toEqual(await missing.json());
});

test("should refuse a revoked token", async ({ page }) => {
  const token = await createToken(page, "MCP revoked");
  await page.getByRole("button", { name: "I saved it" }).click();
  await page
    .getByRole("listitem")
    .filter({ hasText: "MCP revoked" })
    .getByRole("button", { name: "Revoke" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Revoke token" })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();

  const response = await post(page, `Bearer ${token}`);

  expect(response.status()).toBe(401);
});

test("should refuse a batch of requests", async ({ page }) => {
  const token = await createToken(page, "MCP batch");

  const response = await page.request.post("/api/mcp", {
    data: [initialize, initialize],
    headers: {
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${token}`,
    },
  });

  expect(response.status()).toBe(400);
});

test("should answer 429 over the rate limit", async ({ page }) => {
  const name = `Limited ${crypto.randomUUID()}`;
  const token = await createToken(page, name);
  const [{ user_id: userId }] =
    await sql`select user_id from api_tokens where name = ${name}`;
  await sql`
    insert into rate_limits (user_id, action, count)
    values (${userId}, 'mcp', 60)`;

  const response = await post(page, `Bearer ${token}`);

  expect(response.status()).toBe(429);
});
