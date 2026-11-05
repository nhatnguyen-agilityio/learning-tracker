import { describe, expect, it } from "vitest";
import { isCurrentNavItem } from "./nav";

describe("isCurrentNavItem", () => {
  it("should mark Today as current when the path is the home page", () => {
    expect(isCurrentNavItem("/", "/")).toBe(true);
  });

  it("should not mark Today as current when the path is another page", () => {
    expect(isCurrentNavItem("/", "/library")).toBe(false);
  });

  it.each(["/library", "/library/123"])(
    "should mark Library as current when the path is inside it: %s",
    (pathname) => {
      expect(isCurrentNavItem("/library", pathname)).toBe(true);
    },
  );

  it("should not mark Library as current when a path only starts the same", () => {
    expect(isCurrentNavItem("/library", "/library-old")).toBe(false);
  });
});
