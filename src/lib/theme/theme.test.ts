import { describe, expect, it } from "vitest";
import { resolveTheme } from "./theme";

describe("resolveTheme", () => {
  it.each(["light", "dark"] as const)(
    "should keep the theme when the cookie is valid: %s",
    (theme) => {
      expect(resolveTheme(theme)).toBe(theme);
    },
  );

  it.each([undefined, "", "blue"])(
    "should use light when the theme cookie is missing or invalid: %s",
    (value) => {
      expect(resolveTheme(value)).toBe("light");
    },
  );
});
