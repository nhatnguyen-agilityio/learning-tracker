import { protectedResourceResponse } from "@/lib/mcp/metadata";

export function GET(request: Request) {
  return protectedResourceResponse(request);
}
