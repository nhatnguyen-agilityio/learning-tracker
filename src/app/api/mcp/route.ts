import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { NextResponse } from "next/server";
import { TOKEN_PREFIX, verifyToken } from "@/domain/api-tokens";
import { checkRateLimit, MCP_LIMIT } from "@/domain/rate-limit";
import { getDb } from "@/lib/db/client";
import { readBearerToken, verifyOAuthToken } from "@/lib/mcp/auth";
import { publicOrigin, resourceMetadataUrl } from "@/lib/mcp/metadata";
import { createMcpServer } from "@/lib/mcp/server";

/** API tokens are for Claude Code; everything else must come from OAuth. */
function findUser(token: string | null) {
  if (!token) return null;
  return token.startsWith(TOKEN_PREFIX)
    ? verifyToken(getDb(), token, new Date())
    : verifyOAuthToken(token);
}

function metadataUrl(request: Request) {
  return resourceMetadataUrl(
    publicOrigin(request.headers, new URL(request.url).origin),
  );
}

async function handle(request: Request) {
  const db = getDb();
  const token = readBearerToken(request.headers.get("authorization"));
  const userId = await findUser(token);

  // One answer for missing, wrong and revoked, so it reveals nothing.
  if (!userId) {
    return NextResponse.json(
      { error: "unauthorized" },
      {
        status: 401,
        headers: {
          "www-authenticate": `Bearer resource_metadata="${metadataUrl(request)}"`,
        },
      },
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
