import { describe, expect, it } from "vitest";
import { statusAfterProgress } from "./resource-status";

describe("statusAfterProgress", () => {
  it("should move to learning when a wanted source gains progress", () => {
    expect(statusAfterProgress("want", 5)).toBe("learning");
  });

  it("should stay wanted when progress is 0", () => {
    expect(statusAfterProgress("want", 0)).toBe("want");
  });

  it("should keep done when progress changes", () => {
    expect(statusAfterProgress("done", 40)).toBe("done");
  });
});
