import { describe, expect, it } from "vitest";
import { isKnownRedirect, redirectHost } from "./known-clients";

describe("isKnownRedirect", () => {
  it.each([
    "https://claude.ai/api/mcp/auth_callback",
    "https://claude.com/api/mcp/auth_callback",
    "http://localhost:4000/callback",
    "http://127.0.0.1:9/callback",
    "http://[::1]:4000/callback",
  ])("should know %s", (uri) => {
    expect(isKnownRedirect(uri)).toBe(true);
  });

  it.each([
    "http://claude.ai/api/mcp/auth_callback",
    "https://claude.ai.example.com/callback",
    "https://notclaude.ai/callback",
    "https://claude.ai@example.com/callback",
    "https://example.com/claude.ai",
    "https://claude.ai/redirect?to=https://example.com",
    "https://claude.ai/api/mcp/auth_callback?next=example.com",
    "https://user@claude.ai/api/mcp/auth_callback",
    "claude://claude.ai/api/mcp/auth_callback",
    "myapp://localhost/callback",
    "not an address",
    "",
  ])("should not know %j", (uri) => {
    expect(isKnownRedirect(uri)).toBe(false);
  });
});

describe("redirectHost", () => {
  it("should show the host when the address has one", () => {
    expect(redirectHost("https://example.com:8443/callback")).toBe(
      "example.com:8443",
    );
  });

  it.each([
    "myapp:/callback",
    "myapp://claude.ai/callback",
    "http://claude.ai/callback",
    "not an address",
  ])("should show the whole address when it is %s", (uri) => {
    expect(redirectHost(uri)).toBe(uri);
  });
});
