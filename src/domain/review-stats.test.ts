import { describe, expect, it } from "vitest";
import { computeRecallRate, computeStreak } from "./review-stats";

const TODAY = "2026-11-06";

describe("computeStreak", () => {
  it("should be 0 when the user never reviewed", () => {
    expect(computeStreak([], [], TODAY)).toBe(0);
  });

  it("should count consecutive days", () => {
    const days = ["2026-11-04", "2026-11-05", "2026-11-06"];

    expect(computeStreak(days, [], TODAY)).toBe(3);
  });

  it("should count a day once when it has many reviews", () => {
    expect(computeStreak([TODAY, TODAY, TODAY], [], TODAY)).toBe(1);
  });

  it("should keep the streak when today has no review yet", () => {
    const days = ["2026-11-04", "2026-11-05"];
    const dueToday = [{ from: TODAY, until: null }];

    expect(computeStreak(days, dueToday, TODAY)).toBe(2);
  });

  it("should neither break nor extend on a day with no due cards", () => {
    const days = ["2026-11-03", "2026-11-04", "2026-11-06"];

    expect(computeStreak(days, [], TODAY)).toBe(3);
  });

  it("should break when a card was due on a day with no review", () => {
    const days = ["2026-11-03", "2026-11-04", "2026-11-06"];
    const spans = [{ from: "2026-11-05", until: "2026-11-06" }];

    expect(computeStreak(days, spans, TODAY)).toBe(1);
  });

  it("should break when a still waiting card was due that day", () => {
    const days = ["2026-11-03", "2026-11-04"];
    const spans = [{ from: "2026-11-05", until: null }];

    expect(computeStreak(days, spans, TODAY)).toBe(0);
  });

  it("should use a card that became due days before the gap", () => {
    const days = ["2026-11-04", "2026-11-06"];
    const spans = [{ from: "2026-11-01", until: "2026-11-06" }];

    expect(computeStreak(days, spans, TODAY)).toBe(1);
  });

  it("should not count a card reviewed before the gap", () => {
    const days = ["2026-11-04", "2026-11-06"];
    const spans = [{ from: "2026-11-01", until: "2026-11-04" }];

    expect(computeStreak(days, spans, TODAY)).toBe(2);
  });

  it("should cross a month boundary", () => {
    const days = ["2026-10-31", "2026-11-01"];

    expect(computeStreak(days, [], "2026-11-01")).toBe(2);
  });
});

describe("computeRecallRate", () => {
  const rating = (cardId: string, value: number, day = TODAY) => ({
    cardId,
    rating: value,
    day,
  });

  it("should be null when there are no ratings", () => {
    expect(computeRecallRate([])).toBeNull();
  });

  it("should count vaguely and remembered as recalled", () => {
    const ratings = [rating("a", 1), rating("b", 2), rating("c", 3)];

    expect(computeRecallRate(ratings)).toBe(67);
  });

  it("should use only the first rating of a card in a day", () => {
    expect(computeRecallRate([rating("a", 1), rating("a", 3)])).toBe(0);
  });

  it("should count a card again on another day", () => {
    const ratings = [rating("a", 1, "2026-11-05"), rating("a", 3)];

    expect(computeRecallRate(ratings)).toBe(50);
  });
});
