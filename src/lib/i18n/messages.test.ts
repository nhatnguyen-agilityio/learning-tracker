import { describe, expect, it } from "vitest";
import en from "./messages/en.json";
import vi from "./messages/vi.json";

type Messages = { [key: string]: string | Messages };

function flattenKeys(messages: Messages, prefix = ""): string[] {
  return Object.entries(messages).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string" ? [path] : flattenKeys(value, path);
  });
}

function findKeyDifferences(first: Messages, second: Messages) {
  const firstKeys = flattenKeys(first);
  const secondKeys = flattenKeys(second);
  return [
    ...firstKeys.filter((key) => !secondKeys.includes(key)),
    ...secondKeys.filter((key) => !firstKeys.includes(key)),
  ];
}

describe("message files", () => {
  it("should have no key differences when comparing vi and en", () => {
    expect(findKeyDifferences(vi, en)).toEqual([]);
  });

  it("should report nested keys when one file is missing them", () => {
    const first = { home: { title: "a", tagline: "b" } };
    const second = { home: { title: "a" }, extra: "c" };

    expect(findKeyDifferences(first, second)).toEqual([
      "home.tagline",
      "extra",
    ]);
  });
});
