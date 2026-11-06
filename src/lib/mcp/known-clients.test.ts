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

  it("should show the whole address when it has no host", () => {
    expect(redirectHost("myapp:/callback")).toBe("myapp:/callback");
  });
});
