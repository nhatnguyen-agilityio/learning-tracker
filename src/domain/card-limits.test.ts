import { describe, expect, it } from "vitest";
import { MAX_CARD_SIDE_BYTES, validateCard } from "./card-limits";

describe("validateCard", () => {
  it("should pass when both sides have text", () => {
    expect(validateCard({ front: "Q", back: "A" })).toBeNull();
  });

  it("should report the empty side when it has only spaces", () => {
    expect(validateCard({ front: "  ", back: "A" })).toEqual({
      front: "empty",
      back: null,
    });
  });

  it("should accept a side when it is exactly 10 KB", () => {
    const side = "a".repeat(MAX_CARD_SIDE_BYTES);

    expect(validateCard({ front: side, back: side })).toBeNull();
  });

  it("should count bytes when the text has Vietnamese accents", () => {
    const back = "ệ".repeat(MAX_CARD_SIDE_BYTES / 2);

    expect(validateCard({ front: "Q", back })).toEqual({
      front: null,
      back: "too_large",
    });
  });
});
