import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { expect, type Page } from "@playwright/test";

/** Creates a token in Settings and connects with it. */
export async function connectMcp(page: Page, baseURL: string) {
  await page.goto("/settings");
  await page.getByLabel("New token name").fill("E2E");
  await expect(async () => {
    await page.getByRole("button", { name: "Create token" }).click();
    await expect(page.getByText(/^lt_/)).toBeVisible({ timeout: 2000 });
  }).toPass();
  const token = await page.getByText(/^lt_/).textContent();

  const client = new Client({ name: "e2e", version: "1.0.0" });
  await client.connect(
    new StreamableHTTPClientTransport(new URL("/api/mcp", baseURL), {
      requestInit: { headers: { authorization: `Bearer ${token}` } },
    }),
  );
  return client;
}

export async function callTool(
  client: Client,
  name: string,
  args: Record<string, unknown>,
) {
  const result = (await client.callTool({ name, arguments: args })) as {
    content: { text: string }[];
  };
  return JSON.parse(result.content[0].text);
}
