import { NextResponse } from "next/server";
import { supabaseEnv } from "@/lib/auth/env";

export const MCP_PATH = "/api/mcp";
const METADATA_PATH = `/.well-known/oauth-protected-resource${MCP_PATH}`;

/** The address people use, which a proxy in front of the app may hide. */
export function publicOrigin(headers: Headers, fallback: string) {
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  const protocol = headers.get("x-forwarded-proto")?.split(",")[0];
  if (!host) return fallback;
  return `${protocol ?? new URL(fallback).protocol.replace(":", "")}://${host}`;
}

export function resourceMetadataUrl(origin: string) {
  return `${origin}${METADATA_PATH}`;
}

/** Tells an MCP client which server signs people in (RFC 9728). */
export function protectedResourceResponse(request: Request) {
  const origin = publicOrigin(request.headers, new URL(request.url).origin);

  return NextResponse.json({
    resource: `${origin}${MCP_PATH}`,
    authorization_servers: [`${supabaseEnv().url}/auth/v1`],
    bearer_methods_supported: ["header"],
  });
}
