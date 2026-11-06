import { describe, expect, it } from "vitest";
import {
  CARDS_PAGE_SIZE,
  MAX_CARD_SIDE_BYTES,
  MAX_CARDS_PER_USER,
  parseCardsShown,
  validateCard,
} from "./card-limits";

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

describe("parseCardsShown", () => {
  it("should use the first page when there is no value", () => {
    expect(parseCardsShown(undefined)).toBe(CARDS_PAGE_SIZE);
  });

  it("should keep a valid number", () => {
    expect(parseCardsShown("200")).toBe(200);
  });

  it.each(["abc", "-5", "1.5", "0"])("should refuse %s", (value) => {
    expect(parseCardsShown(value)).toBe(CARDS_PAGE_SIZE);
  });

  it("should use the first page when the value is repeated", () => {
    expect(parseCardsShown(["200", "300"])).toBe(CARDS_PAGE_SIZE);
  });

  it("should stop at the card limit", () => {
    expect(parseCardsShown("999999")).toBe(MAX_CARDS_PER_USER);
  });
});
