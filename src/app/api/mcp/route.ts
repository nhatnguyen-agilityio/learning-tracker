import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { NextResponse } from "next/server";
import { verifyToken } from "@/domain/api-tokens";
import { checkRateLimit, MCP_LIMIT } from "@/domain/rate-limit";
import { getDb } from "@/lib/db/client";
import { readBearerToken } from "@/lib/mcp/auth";
import { createMcpServer } from "@/lib/mcp/server";

async function handle(request: Request) {
  const db = getDb();
  const token = readBearerToken(request.headers.get("authorization"));
  const userId = token ? await verifyToken(db, token, new Date()) : null;

  // One answer for missing, wrong and revoked, so it reveals nothing.
  if (!userId) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: { "www-authenticate": "Bearer" } },
    );
  }
  if (!(await checkRateLimit(db, userId, "mcp", MCP_LIMIT))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  // A batch would run many calls for one count of the rate limit.
  const body: unknown = await request
    .clone()
    .json()
    .catch(() => null);
  if (Array.isArray(body)) {
    return NextResponse.json({ error: "batch_not_supported" }, { status: 400 });
  }

  // Stateless: serverless functions can't keep a session between requests.
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await createMcpServer(userId).connect(transport);
  return transport.handleRequest(request);
}

export { handle as DELETE, handle as GET, handle as POST };
