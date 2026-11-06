import { describe, expect, it } from "vitest";
import { reviewDayKey, reviewDayStart } from "./review-day";

const at = (iso: string) => new Date(iso);

describe("reviewDayKey", () => {
  it.each([
    ["Asia/Ho_Chi_Minh", "2026-11-06T20:59:59Z", "2026-11-06"],
    ["Asia/Ho_Chi_Minh", "2026-11-06T21:00:00Z", "2026-11-07"],
    ["UTC", "2026-11-07T03:59:59Z", "2026-11-06"],
    ["UTC", "2026-11-07T04:00:00Z", "2026-11-07"],
    ["America/New_York", "2026-11-07T08:59:59Z", "2026-11-06"],
    ["America/New_York", "2026-11-07T09:00:00Z", "2026-11-07"],
    ["Asia/Kolkata", "2026-11-06T22:29:59Z", "2026-11-06"],
    ["Asia/Kolkata", "2026-11-06T22:30:00Z", "2026-11-07"],
  ])("should use the 04:00 boundary in %s at %s", (timezone, now, key) => {
    expect(reviewDayKey(at(now), timezone)).toBe(key);
  });

  it("should stay on the old month when 03:59 is on the first of a month", () => {
    expect(reviewDayKey(at("2026-12-01T03:59:00Z"), "UTC")).toBe("2026-11-30");
  });

  it("should stay on the old year when 03:59 is on January 1", () => {
    expect(reviewDayKey(at("2027-01-01T03:59:00Z"), "UTC")).toBe("2026-12-31");
  });

  it("should use the local clock when clocks go forward", () => {
    const timezone = "America/New_York";

    expect(reviewDayKey(at("2026-03-08T07:59:00Z"), timezone)).toBe(
      "2026-03-07",
    );
    expect(reviewDayKey(at("2026-03-08T08:00:00Z"), timezone)).toBe(
      "2026-03-08",
    );
  });

  it("should use the local clock when clocks go back", () => {
    const timezone = "America/New_York";

    expect(reviewDayKey(at("2026-11-01T08:59:00Z"), timezone)).toBe(
      "2026-10-31",
    );
    expect(reviewDayKey(at("2026-11-01T09:00:00Z"), timezone)).toBe(
      "2026-11-01",
    );
  });
});

describe("reviewDayStart", () => {
  it.each([
    ["UTC", "2026-11-07T12:00:00Z", "2026-11-07T04:00:00.000Z"],
    ["UTC", "2026-11-07T03:00:00Z", "2026-11-06T04:00:00.000Z"],
    ["Asia/Ho_Chi_Minh", "2026-11-07T01:00:00Z", "2026-11-06T21:00:00.000Z"],
    ["Asia/Kolkata", "2026-11-07T01:00:00Z", "2026-11-06T22:30:00.000Z"],
    ["America/New_York", "2026-11-07T12:00:00Z", "2026-11-07T09:00:00.000Z"],
  ])("should find 04:00 in %s at %s", (timezone, now, start) => {
    expect(reviewDayStart(at(now), timezone).toISOString()).toBe(start);
  });

  it("should use the new offset when clocks go forward that day", () => {
    const start = reviewDayStart(
      at("2026-03-08T12:00:00Z"),
      "America/New_York",
    );

    expect(start.toISOString()).toBe("2026-03-08T08:00:00.000Z");
  });

  it("should use the new offset when clocks go back that day", () => {
    const start = reviewDayStart(
      at("2026-11-01T12:00:00Z"),
      "America/New_York",
    );

    expect(start.toISOString()).toBe("2026-11-01T09:00:00.000Z");
  });

  it("should return the exact start when now is 04:00", () => {
    const now = at("2026-11-06T21:00:00Z");

    expect(reviewDayStart(now, "Asia/Ho_Chi_Minh")).toEqual(now);
  });
});
