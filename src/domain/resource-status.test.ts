import { describe, expect, it } from "vitest";
import {
  isResourceStatus,
  isValidProgress,
  shouldSuggestDone,
  statusAfterProgress,
} from "./resource-status";

describe("statusAfterProgress", () => {
  it("should move to learning when a wanted source gains progress", () => {
    expect(statusAfterProgress("want", 5)).toBe("learning");
  });

  it("should stay wanted when progress is 0", () => {
    expect(statusAfterProgress("want", 0)).toBe("want");
  });

  it("should keep learning when progress goes back to 0", () => {
    expect(statusAfterProgress("learning", 0)).toBe("learning");
  });

  it("should keep done when progress changes", () => {
    expect(statusAfterProgress("done", 40)).toBe("done");
  });

  it("should not move to done when progress reaches 100", () => {
    expect(statusAfterProgress("learning", 100)).toBe("learning");
  });
});

describe("shouldSuggestDone", () => {
  it("should suggest done when a source reaches 100%", () => {
    expect(shouldSuggestDone("learning", 100)).toBe(true);
  });

  it("should not suggest done when progress is under 100%", () => {
    expect(shouldSuggestDone("learning", 95)).toBe(false);
  });

  it("should not suggest done when the source is already done", () => {
    expect(shouldSuggestDone("done", 100)).toBe(false);
  });
});

describe("isValidProgress", () => {
  it.each([0, 55, 100])("should accept %d", (progress) => {
    expect(isValidProgress(progress)).toBe(true);
  });

  it.each([-1, 101, 2.5, Number.NaN])("should refuse %d", (progress) => {
    expect(isValidProgress(progress)).toBe(false);
  });
});

describe("isResourceStatus", () => {
  it("should accept a known status", () => {
    expect(isResourceStatus("done")).toBe(true);
  });

  it("should refuse an unknown status", () => {
    expect(isResourceStatus("paused")).toBe(false);
  });
});
