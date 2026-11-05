import { describe, expect, it } from "vitest";
import { resolveTimezone } from "./timezone";

describe("resolveTimezone", () => {
  it.each(["Asia/Ho_Chi_Minh", "Europe/Paris", "UTC"])(
    "should accept the time zone when it is valid: %s",
    (timezone) => {
      expect(resolveTimezone(timezone)).toBe(timezone);
    },
  );

  it.each(["Mars/Olympus", "", "   ", null, undefined, 7])(
    "should fall back to UTC when the time zone is invalid: %s",
    (timezone) => {
      expect(resolveTimezone(timezone)).toBe("UTC");
    },
  );
});
