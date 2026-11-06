import { describe, expect, it } from "vitest";
import {
  cardsLeft,
  currentItem,
  dropCards,
  rateCurrent,
  startNextBatch,
  startSession,
  summarize,
  undoLast,
} from "./session";

const cards = [{ id: "a" }, { id: "b" }];

describe("rating", () => {
  it("should move to the next card", () => {
    const state = rateCurrent(startSession(cards), "remembered", "k1");

    expect(currentItem(state)?.card.id).toBe("b");
    expect(cardsLeft(state)).toBe(1);
  });

  it("should bring a forgotten card back at the end", () => {
    let state = rateCurrent(startSession(cards), "forgot", "k1");

    expect(cardsLeft(state)).toBe(2);

    state = rateCurrent(state, "remembered", "k2");

    expect(currentItem(state)).toEqual({ card: { id: "a" }, again: true });
  });

  it("should not bring a card back when rating vaguely", () => {
    const state = rateCurrent(startSession(cards), "vaguely", "k1");

    expect(state.items).toHaveLength(2);
  });

  it("should bring a card back again when it is forgotten twice", () => {
    let state = startSession([{ id: "a" }]);
    state = rateCurrent(state, "forgot", "k1");
    state = rateCurrent(state, "forgot", "k2");

    expect(cardsLeft(state)).toBe(1);
    expect(currentItem(state)?.again).toBe(true);
  });

  it("should change nothing when no card is left", () => {
    const done = rateCurrent(startSession([{ id: "a" }]), "remembered", "k1");

    expect(rateCurrent(done, "remembered", "k2")).toBe(done);
  });
});

describe("undoing", () => {
  it("should go back to the same card", () => {
    const rated = rateCurrent(startSession(cards), "remembered", "k1");

    const state = undoLast(rated);

    expect(currentItem(state)?.card.id).toBe("a");
    expect(cardsLeft(state)).toBe(2);
  });

  it("should remove the copy added by Forgot", () => {
    const rated = rateCurrent(startSession(cards), "forgot", "k1");

    const state = undoLast(rated);

    expect(state.items).toHaveLength(2);
    expect(currentItem(state)?.again).toBe(false);
  });

  it("should work after the last card", () => {
    const rated = rateCurrent(startSession([{ id: "a" }]), "remembered", "k1");

    expect(currentItem(undoLast(rated))?.card.id).toBe("a");
  });

  it("should undo only once", () => {
    let state = rateCurrent(startSession(cards), "remembered", "k1");
    state = rateCurrent(state, "remembered", "k2");
    state = undoLast(state);

    expect(undoLast(state)).toBe(state);
    expect(currentItem(state)?.card.id).toBe("b");
  });

  it("should do nothing before the first rating", () => {
    const state = startSession(cards);

    expect(undoLast(state)).toBe(state);
  });
});

describe("dropping cards", () => {
  it("should leave out the given cards", () => {
    const state = dropCards(startSession(cards), ["a"]);

    expect(currentItem(state)?.card.id).toBe("b");
    expect(cardsLeft(state)).toBe(1);
  });
});

describe("summarizing", () => {
  const three = [{ id: "a" }, { id: "b" }, { id: "c" }];

  it("should give zeros before any rating", () => {
    expect(summarize(startSession(cards))).toEqual({
      reviewed: 0,
      remembered: 0,
      vaguely: 0,
      forgot: 0,
      recallRate: 0,
    });
  });

  it("should count remembered and vaguely as recalled", () => {
    let state = startSession(three);
    state = rateCurrent(state, "remembered", "k1");
    state = rateCurrent(state, "vaguely", "k2");
    state = rateCurrent(state, "forgot", "k3");

    expect(summarize(state)).toEqual({
      reviewed: 3,
      remembered: 1,
      vaguely: 1,
      forgot: 1,
      recallRate: 67,
    });
  });

  it("should use only the first rating of a card", () => {
    let state = startSession([{ id: "a" }]);
    state = rateCurrent(state, "forgot", "k1");
    state = rateCurrent(state, "remembered", "k2");

    expect(summarize(state)).toMatchObject({
      reviewed: 1,
      forgot: 1,
      remembered: 0,
      recallRate: 0,
    });
  });

  it("should forget a first rating that was undone", () => {
    let state = startSession(cards);
    state = rateCurrent(state, "forgot", "k1");
    state = undoLast(state);
    state = rateCurrent(state, "remembered", "k2");

    expect(summarize(state)).toMatchObject({ forgot: 0, remembered: 1 });
  });

  it("should keep the first rating when a later one is undone", () => {
    let state = startSession([{ id: "a" }]);
    state = rateCurrent(state, "forgot", "k1");
    state = rateCurrent(state, "remembered", "k2");
    state = undoLast(state);

    expect(summarize(state)).toMatchObject({ reviewed: 1, forgot: 1 });
  });

  it("should keep results across batches", () => {
    let state = rateCurrent(startSession(cards), "remembered", "k1");
    state = startNextBatch(state, [{ id: "a" }, { id: "c" }]);
    state = rateCurrent(state, "forgot", "k2");
    state = rateCurrent(state, "forgot", "k3");

    expect(summarize(state)).toMatchObject({
      reviewed: 2,
      remembered: 1,
      forgot: 1,
    });
  });
});
