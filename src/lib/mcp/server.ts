import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getReviewStats } from "@/domain/review-stats";
import { getDb } from "@/lib/db/client";

/** One server per request, so `userId` from the token can't reach another. */
export function createMcpServer(userId: string) {
  const server = new McpServer({ name: "learning-tracker", version: "1.0.0" });

  server.registerTool(
    "get_study_stats",
    { description: "Get the streak, due card count and 30-day recall rate." },
    async () => {
      const { streak, dueCount, recallRate } = await getReviewStats(
        getDb(),
        userId,
        new Date(),
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ streak, dueCount, recallRate }),
          },
        ],
      };
    },
  );

  return server;
}
