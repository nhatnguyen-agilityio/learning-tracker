import { describe, expect, it } from "vitest";
import { isApiPath, isPublicPath, safeNextPath } from "./routes";

describe("isPublicPath", () => {
  it.each([
    "/sign-in",
    "/auth/callback",
    "/terms",
    "/privacy",
    "/test-sign-in",
    "/.well-known/oauth-protected-resource",
  ])("should allow the path when the route is public: %s", (path) => {
    expect(isPublicPath(path)).toBe(true);
  });

  it.each(["/", "/library", "/sign-in-later", "/terms-of-use"])(
    "should protect the path when the route is not public: %s",
    (path) => {
      expect(isPublicPath(path)).toBe(false);
    },
  );
});

describe("isApiPath", () => {
  it("should match a path under /api", () => {
    expect(isApiPath("/api/reviews")).toBe(true);
  });

  it.each(["/api", "/apiary", "/library"])("should not match %s", (path) => {
    expect(isApiPath(path)).toBe(false);
  });
});

describe("safeNextPath", () => {
  it.each([
    ["/library", "/library"],
    ["/library?status=done", "/library?status=done"],
  ])(
    "should keep the path when it stays on the site: %s",
    (value, expected) => {
      expect(safeNextPath(value)).toBe(expected);
    },
  );

  it.each([
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "\\\\evil.test",
    "/\t/evil.test",
    "/.//evil.test",
    "/..//evil.test",
    "/x/..//evil.test",
    "javascript:alert(1)",
    "",
    null,
    undefined,
    ["/library"],
  ])("should reject the redirect when it leaves the site: %s", (value) => {
    expect(safeNextPath(value)).toBe("/");
  });
});
