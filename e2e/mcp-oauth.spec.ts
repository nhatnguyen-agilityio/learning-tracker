import { createHash, randomBytes } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { expect, type Page, test } from "@playwright/test";
import { signInNewUser } from "./sign-in";

const REDIRECT_URI = "http://127.0.0.1:9/callback";

async function discover(page: Page) {
  const resource = await (
    await page.request.get("/.well-known/oauth-protected-resource/api/mcp")
  ).json();
  const issuer = resource.authorization_servers[0];
  const server = await (
    await page.request.get(`${issuer}/.well-known/oauth-authorization-server`)
  ).json();
  return { resource, server };
}

/** Does what Claude does, up to the point where the consent page opens. */
async function startFlow(page: Page) {
  const { server } = await discover(page);
  const registered = await (
    await page.request.post(server.registration_endpoint, {
      data: {
        client_name: "Test connector",
        redirect_uris: [REDIRECT_URI],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
      },
    })
  ).json();

  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const authorize = new URL(server.authorization_endpoint);
  authorize.search = new URLSearchParams({
    response_type: "code",
    client_id: registered.client_id,
    redirect_uri: REDIRECT_URI,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state: "state-1",
  }).toString();

  const response = await page.request.get(authorize.toString(), {
    maxRedirects: 0,
  });
  const location = new URL(response.headers().location);
  const authorizationId = location.searchParams.get("authorization_id");
  await page.goto(`/oauth/consent?authorization_id=${authorizationId}`);

  return { server, clientId: registered.client_id, verifier };
}

/** Catches the redirect back to the client, which has no real server here. */
async function decide(page: Page, button: string) {
  const redirected = new Promise<URL>((resolve) => {
    page.route("http://127.0.0.1:9/**", (route) => {
      resolve(new URL(route.request().url()));
      return route.fulfill({ status: 200, body: "done" });
    });
  });
  await page.getByRole("button", { name: button, exact: true }).click();
  const url = await redirected;
  await page.waitForURL("http://127.0.0.1:9/**");
  return url;
}

async function exchange(
  page: Page,
  flow: Awaited<ReturnType<typeof startFlow>>,
  code: string,
) {
  const response = await page.request.post(flow.server.token_endpoint, {
    form: {
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      client_id: flow.clientId,
      code_verifier: flow.verifier,
    },
  });
  return response.json();
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

test.beforeEach(async ({ page }) => {
  await signInNewUser(page);
});

test("should connect through OAuth and call a tool", async ({
  page,
  baseURL,
}) => {
  const flow = await startFlow(page);
  await expect(
    page.getByRole("heading", { name: /Test connector/ }),
  ).toBeVisible();

  const redirected = await decide(page, "Allow");

  expect(redirected.searchParams.get("state")).toBe("state-1");
  const tokens = await exchange(
    page,
    flow,
    redirected.searchParams.get("code") ?? "",
  );
  const client = await connect(baseURL ?? "", tokens.access_token);
  const { tools } = await client.listTools();
  await client.close();

  expect(tools.map((tool) => tool.name)).toContain("create_cards");
});

test("should give no code when the user denies", async ({ page }) => {
  await startFlow(page);

  const redirected = await decide(page, "Deny");

  expect(redirected.searchParams.get("error")).toBe("access_denied");
  expect(redirected.searchParams.get("code")).toBeNull();
});

test("should list and disconnect a connected app", async ({ page }) => {
  await startFlow(page);
  await decide(page, "Allow");

  await page.goto("/settings");
  const row = page.getByRole("listitem").filter({ hasText: "Test connector" });
  await expect(async () => {
    await row.getByRole("button", { name: "Disconnect" }).click();
    await expect(row).toBeHidden({ timeout: 3000 });
  }).toPass();
});

test("should stop a token when the app is disconnected", async ({ page }) => {
  const flow = await startFlow(page);
  const redirected = await decide(page, "Allow");
  const tokens = await exchange(
    page,
    flow,
    redirected.searchParams.get("code") ?? "",
  );

  await page.goto("/settings");
  const row = page.getByRole("listitem").filter({ hasText: "Test connector" });
  await expect(async () => {
    await row.getByRole("button", { name: "Disconnect" }).click();
    await expect(row).toBeHidden({ timeout: 3000 });
  }).toPass();

  const response = await page.request.post("/api/mcp", {
    headers: { authorization: `Bearer ${tokens.access_token}` },
    data: { jsonrpc: "2.0", id: 1, method: "tools/list" },
  });
  expect(response.status()).toBe(401);
});

test("should not accept an OAuth token as a web session", async ({
  page,
  context,
}) => {
  const flow = await startFlow(page);
  const redirected = await decide(page, "Allow");
  const tokens = await exchange(
    page,
    flow,
    redirected.searchParams.get("code") ?? "",
  );

  const cookies = await context.cookies();
  const session = cookies.filter((cookie) =>
    /^sb-.*-auth-token(\.\d+)?$/.test(cookie.name),
  );
  const name = session[0].name.replace(/\.\d+$/, "");
  await context.clearCookies();
  await context.addCookies([
    {
      ...session[0],
      name,
      value: `base64-${Buffer.from(
        JSON.stringify({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_type: "bearer",
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: { id: "unused" },
        }),
      ).toString("base64url")}`,
    },
  ]);

  await page.goto("/settings");

  await expect(page).toHaveURL(/\/sign-in/);
  const exported = await page.request.get("/api/export");
  expect(exported.ok()).toBe(false);
});

test("should explain a bad consent link", async ({ page }) => {
  await page.goto("/oauth/consent?authorization_id=nope");

  await expect(
    page.getByRole("heading", { name: "This link doesn't work" }),
  ).toBeVisible();
});

test("should tell clients where to sign in", async ({ page }) => {
  const { resource, server } = await discover(page);
  const refused = await page.request.post("/api/mcp", { data: {} });

  expect(resource.resource).toMatch(/\/api\/mcp$/);
  expect(server.code_challenge_methods_supported).toContain("S256");
  expect(server.registration_endpoint).toBeTruthy();
  expect(refused.status()).toBe(401);
  expect(refused.headers()["www-authenticate"]).toContain(
    "/.well-known/oauth-protected-resource/api/mcp",
  );
});

test("should refuse a web session token", async ({ page, context }) => {
  const parts = (await context.cookies())
    .filter((cookie) => /auth-token(\.\d+)?$/.test(cookie.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  const session = decodeURIComponent(
    parts.map((cookie) => cookie.value).join(""),
  );
  const decoded = JSON.parse(
    Buffer.from(session.replace(/^base64-/, ""), "base64url").toString(),
  );
  expect(decoded.access_token).toBeTruthy();

  const response = await page.request.post("/api/mcp", {
    data: {},
    headers: { authorization: `Bearer ${decoded.access_token}` },
  });

  expect(response.status()).toBe(401);
});

test("should show the connector address in Settings", async ({
  page,
  baseURL,
}) => {
  await page.goto("/settings");

  await expect(page.getByText(`${baseURL}/api/mcp`)).toBeVisible();
  await expect(page.getByText("Add custom connector")).toBeVisible();
});

test("should not open consent inside a frame", async ({ page }) => {
  const response = await page.request.get("/oauth/consent");

  expect(response.headers()["x-frame-options"]).toBe("DENY");
});
