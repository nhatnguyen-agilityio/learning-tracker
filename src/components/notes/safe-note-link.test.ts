import { describe, expect, it } from "vitest";
import { safeNoteLink } from "./safe-note-link";

describe("safeNoteLink", () => {
  it.each([
    "https://example.com/a",
    "http://example.com",
    "HTTPS://example.com",
  ])("should keep the address when it is %s", (url) => {
    expect(safeNoteLink(url)).toBe(url);
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,hi",
    "mailto:a@example.com",
    "/library",
    "//example.com",
  ])("should drop the address when it is %s", (url) => {
    expect(safeNoteLink(url)).toBeUndefined();
  });
});
