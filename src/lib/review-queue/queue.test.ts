import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createReviewQueue,
  type QueuedAction,
  type QueuedRating,
  type QueueStatus,
  retryDelay,
  type SendResult,
} from "./queue";

const entry = (id: string): QueuedRating => ({
  cardId: id,
  rating: "remembered",
  idempotencyKey: `key-${id}`,
});

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

function setup(results: SendResult[], storage = memoryStorage()) {
  const sent: string[] = [];
  const restored: string[] = [];
  const states: { pending: number; status: QueueStatus }[] = [];
  const queue = createReviewQueue({
    userId: "user-a",
    storage,
    send: async (item) => {
      sent.push("cardId" in item ? item.cardId : `undo:${item.idempotencyKey}`);
      return results.shift() ?? "done";
    },
    onChange: (state) => states.push(state),
    onRestore: (ids) => restored.push(...ids),
  });
  return { queue, sent, states, storage, restored };
}

const stored = (storage: ReturnType<typeof memoryStorage>) =>
  JSON.parse(storage.getItem("review-queue:user-a") ?? "[]");

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("sending", () => {
  it("should send ratings in order", async () => {
    const { queue, sent } = setup([]);

    queue.add(entry("a"));
    queue.add(entry("b"));
    await vi.runAllTimersAsync();

    expect(sent).toEqual(["a", "b"]);
  });

  it("should write the rating to storage before it is sent", () => {
    const storage = memoryStorage();
    const queue = createReviewQueue({
      userId: "user-a",
      storage,
      send: () => new Promise(() => {}),
      onChange: () => {},
    });

    queue.add(entry("a"));

    expect(stored(storage)).toEqual([entry("a")]);
  });

  it("should clear storage when a rating is saved", async () => {
    const { queue, storage, states } = setup(["done"]);

    queue.add(entry("a"));
    await vi.runAllTimersAsync();

    expect(stored(storage)).toEqual([]);
    expect(states.at(-1)).toEqual({ pending: 0, status: "idle" });
  });
});

describe("retrying", () => {
  it("should keep the rating and try again after a network error", async () => {
    const { queue, sent, storage, states } = setup(["retry", "done"]);

    queue.add(entry("a"));
    await vi.advanceTimersByTimeAsync(0);

    expect(stored(storage)).toEqual([entry("a")]);
    expect(states.at(-1)).toEqual({ pending: 1, status: "retrying" });

    await vi.advanceTimersByTimeAsync(1000);

    expect(sent).toEqual(["a", "a"]);
    expect(stored(storage)).toEqual([]);
  });

  it("should retry when sending throws", async () => {
    const storage = memoryStorage();
    let calls = 0;
    const queue = createReviewQueue({
      userId: "user-a",
      storage,
      send: async () => {
        calls += 1;
        if (calls === 1) throw new Error("offline");
        return "done";
      },
      onChange: () => {},
    });

    queue.add(entry("a"));
    await vi.advanceTimersByTimeAsync(1000);

    expect(calls).toBe(2);
    expect(stored(storage)).toEqual([]);
  });

  it("should wait longer each time, up to 30 seconds", () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(retryDelay)).toEqual([
      1000, 2000, 4000, 8000, 16000, 30000, 30000,
    ]);
  });

  it("should not let a later rating pass a failed one", async () => {
    const { queue, sent } = setup(["retry"]);

    queue.add(entry("a"));
    await vi.advanceTimersByTimeAsync(0);
    queue.add(entry("b"));
    await vi.runAllTimersAsync();

    expect(sent).toEqual(["a", "a", "b"]);
  });

  it("should send at once when the network comes back", async () => {
    const { queue, sent } = setup(["retry", "done"]);

    queue.add(entry("a"));
    await vi.advanceTimersByTimeAsync(0);
    queue.retryNow();
    await vi.advanceTimersByTimeAsync(0);

    expect(sent).toEqual(["a", "a"]);
  });
});

describe("responses that end a retry", () => {
  it("should drop a rating the server refuses and go on", async () => {
    const { queue, sent, storage } = setup(["drop", "done"]);

    queue.add(entry("a"));
    queue.add(entry("b"));
    await vi.runAllTimersAsync();

    expect(sent).toEqual(["a", "b"]);
    expect(stored(storage)).toEqual([]);
  });

  it("should stop and keep ratings when the session has ended", async () => {
    const { queue, sent, storage, states } = setup(["stop"]);

    queue.add(entry("a"));
    await vi.runAllTimersAsync();

    expect(sent).toEqual(["a"]);
    expect(stored(storage)).toEqual([entry("a")]);
    expect(states.at(-1)?.status).toBe("stopped");
  });
});

describe("restoring", () => {
  it("should send what a past visit left and return the card ids", async () => {
    const storage = memoryStorage({
      "review-queue:user-a": JSON.stringify([entry("a"), entry("b")]),
    });
    const { queue, sent, restored } = setup([], storage);

    queue.start();
    await vi.runAllTimersAsync();

    expect(restored).toEqual(["a", "b"]);
    expect(sent).toEqual(["a", "b"]);
  });

  it("should not send another user's ratings", async () => {
    const storage = memoryStorage({
      "review-queue:user-b": JSON.stringify([entry("a")]),
    });
    const { queue, sent, restored } = setup([], storage);

    queue.start();
    await vi.runAllTimersAsync();

    expect(restored).toEqual([]);
    expect(sent).toEqual([]);
  });

  it("should ignore storage that is not valid", async () => {
    const storage = memoryStorage({ "review-queue:user-a": "{oops" });
    const { queue, sent, restored } = setup([], storage);

    queue.start();
    await vi.runAllTimersAsync();

    expect(restored).toEqual([]);
    expect(sent).toEqual([]);
  });

  it("should skip stored items with the wrong shape", () => {
    const storage = memoryStorage({
      "review-queue:user-a": JSON.stringify([{ nope: 1 }, entry("a")]),
    });
    const { queue, restored } = setup([], storage);

    queue.start();

    expect(restored).toEqual(["a"]);
  });
});

describe("blocked storage", () => {
  it("should still send when storage throws", async () => {
    const sent: string[] = [];
    const queue = createReviewQueue({
      userId: "user-a",
      storage: {
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {
          throw new Error("blocked");
        },
      },
      send: async (item) => {
        sent.push("cardId" in item ? item.cardId : "undo");
        return "done";
      },
      onChange: () => {},
    });

    queue.start();
    queue.add(entry("a"));
    await vi.runAllTimersAsync();

    expect(sent).toEqual(["a"]);
  });

  it("should still send when there is no storage", async () => {
    const sent: string[] = [];
    const queue = createReviewQueue({
      userId: "user-a",
      storage: null,
      send: async (item) => {
        sent.push("cardId" in item ? item.cardId : "undo");
        return "done";
      },
      onChange: () => {},
    });

    queue.add(entry("a"));
    await vi.runAllTimersAsync();

    expect(sent).toEqual(["a"]);
  });
});

describe("undoing", () => {
  const undo = (id: string): QueuedAction => ({
    undo: true,
    idempotencyKey: `key-${id}`,
  });

  function recording(storage = memoryStorage()) {
    const sent: QueuedAction[] = [];
    let release: (() => void) | undefined;
    const queue = createReviewQueue({
      userId: "user-a",
      storage,
      send: async (item) => {
        sent.push(item);
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return "done";
      },
      onChange: () => {},
    });
    return { queue, sent, finish: () => release?.() };
  }

  it("should remove a rating that is still waiting and call nothing", async () => {
    const { queue, sent, states, storage } = setup(["retry"]);

    queue.add(entry("a"));
    await vi.advanceTimersByTimeAsync(0);
    const before = sent.length;
    queue.undo("key-a");
    await vi.runAllTimersAsync();

    expect(sent).toHaveLength(before);
    expect(stored(storage)).toEqual([]);
    expect(states.at(-1)).toEqual({ pending: 0, status: "idle" });
  });

  it("should send undo after a rating that is being sent", async () => {
    const { queue, sent, finish } = recording();

    queue.add(entry("a"));
    queue.undo("key-a");
    finish();
    await vi.advanceTimersByTimeAsync(0);
    finish();
    await vi.advanceTimersByTimeAsync(0);

    expect(sent).toEqual([entry("a"), undo("a")]);
  });

  it("should send undo for a rating that was already sent", async () => {
    const { queue, sent } = setup([]);

    queue.add(entry("a"));
    await vi.runAllTimersAsync();
    queue.undo("key-a");
    await vi.runAllTimersAsync();

    expect(sent).toHaveLength(2);
  });

  it("should remove only the undone rating from a waiting line", async () => {
    const { queue, storage } = setup(["retry"]);

    queue.add(entry("a"));
    await vi.advanceTimersByTimeAsync(0);
    queue.add(entry("b"));
    queue.undo("key-b");

    expect(stored(storage)).toEqual([entry("a")]);
  });

  it("should keep the card in the session when its rating was undone", () => {
    const storage = memoryStorage({
      "review-queue:user-a": JSON.stringify([
        entry("a"),
        undo("a"),
        entry("b"),
      ]),
    });
    const { queue, restored } = setup([], storage);

    queue.start();

    expect(restored).toEqual(["b"]);
  });
});
