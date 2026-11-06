import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { expect, type Page, test } from "@playwright/test";
import { addResource } from "./resources";
import { signInNewUser } from "./sign-in";

async function createToken(page: Page) {
  await page.goto("/settings");
  await page.getByLabel("New token name").fill("Reader");
  await expect(async () => {
    await page.getByRole("button", { name: "Create token" }).click();
    await expect(page.locator("code")).toBeVisible({ timeout: 2000 });
  }).toPass();
  return (await page.locator("code").textContent()) ?? "";
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

type ToolResult = {
  isError?: boolean;
  content: { type: string; text: string }[];
};

async function call(
  client: Client,
  name: string,
  args: Record<string, unknown> = {},
) {
  const result = (await client.callTool({
    name,
    arguments: args,
  })) as ToolResult;
  return result;
}

const parse = (result: ToolResult) => JSON.parse(result.content[0].text);

test("should search, read a resource and keep users apart", async ({
  page,
  context,
  baseURL,
}) => {
  const title = `Shared search ${crypto.randomUUID()}`;
  await signInNewUser(page);
  await page.goto("/library");
  await addResource(page, title, undefined, "Want to learn");
  const ownerToken = await createToken(page);

  await context.clearCookies();
  await signInNewUser(page);
  const otherToken = await createToken(page);

  const owner = await connect(baseURL ?? "", ownerToken);
  const other = await connect(baseURL ?? "", otherToken);

  const found = parse(await call(owner, "search_resources", { query: title }));
  expect(found).toHaveLength(1);
  expect(found[0]).toMatchObject({ title, topics: [], progress: 0 });

  const resource = parse(
    await call(owner, "get_resource", { resource_id: found[0].id }),
  );
  expect(resource).toMatchObject({ title, notes: [], cards: [] });

  expect(
    parse(await call(other, "search_resources", { query: title })),
  ).toEqual([]);
  const refused = await call(other, "get_resource", {
    resource_id: found[0].id,
  });
  expect(refused.isError).toBe(true);
  expect(refused.content[0].text).toBe("Resource not found.");

  await owner.close();
  await other.close();
});

test("should answer the same for a missing resource", async ({
  page,
  baseURL,
}) => {
  await signInNewUser(page);
  const client = await connect(baseURL ?? "", await createToken(page));

  const result = await call(client, "get_resource", {
    resource_id: crypto.randomUUID(),
  });

  expect(result.content[0].text).toBe("Resource not found.");
  await client.close();
});

test("should read stats for a range", async ({ page, baseURL }) => {
  await signInNewUser(page);
  const client = await connect(baseURL ?? "", await createToken(page));

  expect(parse(await call(client, "get_study_stats"))).toEqual({
    streak: 0,
    dueCount: 0,
    recallRate: null,
    range: "30d",
  });
  expect(parse(await call(client, "get_study_stats", { range: "7d" }))).toEqual(
    { streak: 0, dueCount: 0, recallRate: null, range: "7d" },
  );
  await client.close();
});

test("should refuse wrong input", async ({ page, baseURL }) => {
  await signInNewUser(page);
  const client = await connect(baseURL ?? "", await createToken(page));

  const badStatus = await call(client, "search_resources", {
    status: "paused",
  });
  const badRange = await call(client, "get_study_stats", { range: "1y" });

  expect(badStatus.isError).toBe(true);
  expect(badRange.isError).toBe(true);
  await client.close();
});
