import { describe, expect, it } from "vitest";
import { detectType } from "./detect-type";

describe("detectType", () => {
  it.each([
    ["video", "https://www.youtube.com/watch?v=a", null],
    ["video", "https://youtu.be/a", null],
    ["video", "https://example.test/a", "video.other"],
    ["course", "https://www.udemy.com/course/a", null],
    ["course", "https://www.coursera.org/learn/a", null],
    ["doc", "https://docs.example.test/a", null],
    ["doc", "https://example.test/docs/a", null],
    ["article", "https://example.test/a", "article"],
    ["other", "https://example.test/a", null],
    ["other", "https://example.test/a", "website"],
  ])(
    "should detect %s when the link is %s with og:type %s",
    (type, url, og) => {
      expect(detectType(new URL(url), og)).toBe(type);
    },
  );

  it("should not treat a look-alike host as a course site", () => {
    expect(detectType(new URL("https://notudemy.com/a"), null)).toBe("other");
  });

  it("should not treat a path that only contains docs as documentation", () => {
    expect(detectType(new URL("https://example.test/mydocs/a"), null)).toBe(
      "other",
    );
  });
});
