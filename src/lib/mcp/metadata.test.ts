import { describe, expect, it } from "vitest";
import { publicOrigin, resourceMetadataUrl } from "./metadata";

describe("publicOrigin", () => {
  const fallback = "http://internal:3000";

  it("should use the forwarded host and protocol", () => {
    const headers = new Headers({
      "x-forwarded-host": "app.test",
      "x-forwarded-proto": "https",
    });

    expect(publicOrigin(headers, fallback)).toBe("https://app.test");
  });

  it("should use the first protocol when there are several", () => {
    const headers = new Headers({
      host: "app.test",
      "x-forwarded-proto": "https,http",
    });

    expect(publicOrigin(headers, fallback)).toBe("https://app.test");
  });

  it("should use the host header with the request's protocol", () => {
    const headers = new Headers({ host: "localhost:3000" });

    expect(publicOrigin(headers, fallback)).toBe("http://localhost:3000");
  });

  it("should use the fallback when there is no host", () => {
    expect(publicOrigin(new Headers(), fallback)).toBe(fallback);
  });
});

describe("resourceMetadataUrl", () => {
  it("should add the path of the MCP endpoint", () => {
    expect(resourceMetadataUrl("https://app.test")).toBe(
      "https://app.test/.well-known/oauth-protected-resource/api/mcp",
    );
  });
});
