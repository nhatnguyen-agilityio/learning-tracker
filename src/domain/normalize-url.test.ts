import { describe, expect, it } from "vitest";
import { normalizeUrl } from "./normalize-url";

describe("normalizeUrl", () => {
  it.each([
    ["host case", "https://Example.COM/Docs", "https://example.com/Docs"],
    ["http", "http://example.com/a", "https://example.com/a"],
    ["default http port", "http://example.com:80/a", "https://example.com/a"],
    [
      "default https port",
      "https://example.com:443/a",
      "https://example.com/a",
    ],
    ["trailing slash", "https://example.com/a/", "https://example.com/a"],
    ["root slash", "https://example.com/", "https://example.com"],
    ["fragment", "https://example.com/a#part", "https://example.com/a"],
    ["spaces", "  https://example.com/a  ", "https://example.com/a"],
    [
      "utm parameters",
      "https://example.com/a?utm_source=x&utm_medium=y",
      "https://example.com/a",
    ],
    ["fbclid", "https://example.com/a?fbclid=1", "https://example.com/a"],
    ["gclid", "https://example.com/a?gclid=1", "https://example.com/a"],
    [
      "parameter order",
      "https://example.com/a?b=2&a=1",
      "https://example.com/a?a=1&b=2",
    ],
  ])(
    "should ignore the difference when it is only %s",
    (_name, input, expected) => {
      expect(normalizeUrl(input)).toBe(expected);
    },
  );

  it("should treat a short YouTube link as the full link when both point at one video", () => {
    expect(normalizeUrl("https://youtu.be/abc123?si=share")).toBe(
      normalizeUrl("https://www.youtube.com/watch?v=abc123"),
    );
  });

  it("should keep the start time when a YouTube link has one", () => {
    expect(normalizeUrl("https://youtu.be/abc123?t=30")).toBe(
      "https://www.youtube.com/watch?t=30&v=abc123",
    );
  });

  it("should keep www when a link has it", () => {
    expect(normalizeUrl("https://www.example.com/a")).toBe(
      "https://www.example.com/a",
    );
  });

  it("should keep query values when they are not tracking parameters", () => {
    expect(normalizeUrl("https://example.com/a?page=2")).toBe(
      "https://example.com/a?page=2",
    );
  });

  it("should keep a custom port when a link has one", () => {
    expect(normalizeUrl("https://example.com:8443/a")).toBe(
      "https://example.com:8443/a",
    );
  });

  it("should keep path case when it differs", () => {
    expect(normalizeUrl("https://example.com/A")).not.toBe(
      normalizeUrl("https://example.com/a"),
    );
  });

  it.each([
    "ftp://example.com",
    "javascript:alert(1)",
    "example.com",
    "",
    "not a link",
  ])("should return null when the link is not http or https: %s", (input) => {
    expect(normalizeUrl(input)).toBeNull();
  });
});
