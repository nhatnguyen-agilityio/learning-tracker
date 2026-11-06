import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { expect, type Page, test } from "@playwright/test";
import { signInNewUser } from "./sign-in";

async function createToken(page: Page) {
  await page.goto("/settings");
  await page.getByLabel("New token name").fill("Writer");
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

const call = async (
  client: Client,
  name: string,
  args: Record<string, unknown>,
) => (await client.callTool({ name, arguments: args })) as ToolResult;

const parse = (result: ToolResult) => JSON.parse(result.content[0].text);

test.beforeEach(async ({ page }) => {
  await signInNewUser(page);
});

test("should add a resource, a note and pending cards", async ({
  page,
  baseURL,
}) => {
  const client = await connect(baseURL ?? "", await createToken(page));
  const url = `https://no-such-host.invalid/${crypto.randomUUID()}`;

  const resource = parse(
    await call(client, "add_resource", {
      url,
      topics: ["From Claude"],
      status: "learning",
    }),
  );
  expect(resource.duplicate).toBe(false);
  await call(client, "add_note", {
    resource_id: resource.id,
    content: "Written by Claude",
  });
  const cards = parse(
    await call(client, "create_cards", {
      resource_id: resource.id,
      cards: [{ type: "qa", front: "Proposed front", back: "Proposed back" }],
    }),
  );
  await client.close();
  expect(cards.status).toBe("pending");

  await page.goto(`/library/${resource.id}`);
  await expect(page.getByText("From Claude")).toBeVisible();
  await expect(page.getByText("Written by Claude")).toBeVisible();

  await page.goto("/cards");
  await expect(page.getByText("Proposed front")).toBeHidden();
  await page.goto("/review");
  await expect(page.getByText("No cards left for now.")).toBeVisible();
});

test("should return the same resource when added twice", async ({
  page,
  baseURL,
}) => {
  const client = await connect(baseURL ?? "", await createToken(page));
  const url = `https://no-such-host.invalid/${crypto.randomUUID()}`;

  const first = parse(await call(client, "add_resource", { url }));
  const second = parse(await call(client, "add_resource", { url }));
  await client.close();

  expect(second).toMatchObject({ id: first.id, duplicate: true });
});

test("should have no delete tool", async ({ page, baseURL }) => {
  const client = await connect(baseURL ?? "", await createToken(page));

  const { tools } = await client.listTools();
  await client.close();

  expect(tools.map((tool) => tool.name).sort()).toEqual([
    "add_note",
    "add_resource",
    "create_cards",
    "get_resource",
    "get_study_stats",
    "search_resources",
  ]);
});

test("should refuse to write to another user's resource", async ({
  page,
  context,
  baseURL,
}) => {
  const owner = await connect(baseURL ?? "", await createToken(page));
  const resource = parse(
    await call(owner, "add_resource", {
      url: `https://no-such-host.invalid/${crypto.randomUUID()}`,
    }),
  );
  await owner.close();

  await context.clearCookies();
  await signInNewUser(page);
  const other = await connect(baseURL ?? "", await createToken(page));

  const note = await call(other, "add_note", {
    resource_id: resource.id,
    content: "Intruder",
  });
  const cards = await call(other, "create_cards", {
    resource_id: resource.id,
    cards: [{ type: "qa", front: "Q", back: "A" }],
  });
  await other.close();

  expect(note.isError).toBe(true);
  expect(note.content[0].text).toBe("Resource not found.");
  expect(cards.content[0].text).toBe("Resource not found.");
});

test("should refuse too many cards in one call", async ({ page, baseURL }) => {
  const client = await connect(baseURL ?? "", await createToken(page));

  const result = await call(client, "create_cards", {
    cards: Array.from({ length: 51 }, () => ({
      type: "qa",
      front: "Q",
      back: "A",
    })),
  });
  await client.close();

  expect(result.isError).toBe(true);
});
