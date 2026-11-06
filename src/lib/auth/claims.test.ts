import { describe, expect, it } from "vitest";
import { webUserIdFromClaims } from "./claims";

describe("webUserIdFromClaims", () => {
  it("should return the user when the token is a web session", () => {
    expect(webUserIdFromClaims({ sub: "user-1" })).toBe("user-1");
  });

  it.each([
    [{ sub: "user-1", client_id: "client-1" }],
    [{ sub: "user-1", client_id: "" }],
    [{ sub: "" }],
    [{}],
    [null],
    [undefined],
  ])("should refuse %j", (claims) => {
    expect(webUserIdFromClaims(claims)).toBeNull();
  });
});
