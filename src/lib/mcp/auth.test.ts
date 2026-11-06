import { describe, expect, it } from "vitest";
import { readBearerToken, userIdFromClaims } from "./auth";

describe("readBearerToken", () => {
  it("should read the token when the header is right", () => {
    expect(readBearerToken("Bearer lt_abc")).toBe("lt_abc");
  });

  it("should accept any case for the scheme", () => {
    expect(readBearerToken("bearer lt_abc")).toBe("lt_abc");
  });

  it.each([null, "", "Bearer", "Bearer ", "Basic lt_abc", "Bearer a b"])(
    "should return null for %j",
    (header) => {
      expect(readBearerToken(header)).toBeNull();
    },
  );
});

describe("userIdFromClaims", () => {
  it("should return the user when the token came from OAuth", () => {
    expect(userIdFromClaims({ sub: "user-1", client_id: "client-1" })).toBe(
      "user-1",
    );
  });

  it.each([
    [{ sub: "user-1" }],
    [{ sub: "user-1", client_id: "" }],
    [{ sub: "user-1", client_id: 5 }],
    [{ client_id: "client-1" }],
    [null],
    [undefined],
  ])("should refuse %j", (claims) => {
    expect(userIdFromClaims(claims)).toBeNull();
  });
});
