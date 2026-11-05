import { describe, expect, it } from "vitest";
import { isLocale, resolveLocale } from "./locale";

describe("resolveLocale", () => {
  it("should use the cookie when it holds a supported language", () => {
    expect(resolveLocale("en", "vi-VN,vi;q=0.9")).toBe("en");
    expect(resolveLocale("vi", "en-US")).toBe("vi");
  });

  it("should fall back to the browser language when the cookie is invalid", () => {
    expect(resolveLocale("fr", "vi-VN")).toBe("vi");
  });

  it("should use Vietnamese when the browser prefers it", () => {
    expect(resolveLocale(undefined, "vi-VN,vi;q=0.9,en;q=0.8")).toBe("vi");
    expect(resolveLocale(undefined, "en;q=0.5,vi;q=0.9")).toBe("vi");
  });

  it("should use English when the browser prefers another language", () => {
    expect(resolveLocale(undefined, "fr-FR,vi;q=0.5")).toBe("en");
  });

  it("should use English when there is no cookie or header", () => {
    expect(resolveLocale(undefined, null)).toBe("en");
  });
});

describe("isLocale", () => {
  it("should reject a value when it is not a supported language", () => {
    expect(isLocale("vi")).toBe(true);
    expect(isLocale("xx")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});
