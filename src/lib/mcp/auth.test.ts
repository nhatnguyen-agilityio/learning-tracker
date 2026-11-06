import { describe, expect, it } from "vitest";
import { readBearerToken } from "./auth";

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
