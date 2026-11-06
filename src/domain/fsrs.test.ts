import { fsrs, Rating } from "ts-fsrs";
import { describe, expect, it } from "vitest";
import { type CardSchedule, nextSchedule, type ReviewRating } from "./fsrs";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const LEARNING = 1;
const REVIEW = 2;
const RELEARNING = 3;

const start = new Date("2026-11-06T08:00:00Z");

const newCard: CardSchedule = {
  due: start,
  stability: 0,
  difficulty: 0,
  learningSteps: 0,
  reps: 0,
  lapses: 0,
  state: 0,
  lastReview: null,
};

/** Rates Remembered at each due date until the card reaches the review state. */
function reviewCard() {
  let schedule = newCard;
  let now = start;
  while (schedule.state !== REVIEW) {
    ({ schedule } = nextSchedule(schedule, "remembered", now));
    now = schedule.due;
  }
  return schedule;
}

describe("nextSchedule on a new card", () => {
  it.each<ReviewRating>(["forgot", "vaguely", "remembered"])(
    "should count one review when rating %s",
    (rating) => {
      const { schedule } = nextSchedule(newCard, rating, start);

      expect(schedule.reps).toBe(1);
      expect(schedule.lastReview).toEqual(start);
      expect(schedule.stability).toBeGreaterThan(0);
    },
  );

  it("should bring the card back within the session when rating forgot", () => {
    const { schedule } = nextSchedule(newCard, "forgot", start);

    expect(schedule.state).toBe(LEARNING);
    expect(schedule.due.getTime() - start.getTime()).toBeLessThan(HOUR);
  });

  it("should put a better rating at the same date or later", () => {
    const due = (rating: ReviewRating) =>
      nextSchedule(newCard, rating, start).schedule.due.getTime();

    expect(due("vaguely")).toBeGreaterThanOrEqual(due("forgot"));
    expect(due("remembered")).toBeGreaterThanOrEqual(due("vaguely"));
  });
});

describe("nextSchedule on a reviewed card", () => {
  it("should count a lapse and return in the session when rating forgot", () => {
    const card = reviewCard();

    const { schedule } = nextSchedule(card, "forgot", card.due);

    expect(schedule.lapses).toBe(card.lapses + 1);
    expect(schedule.state).toBe(RELEARNING);
    expect(schedule.due.getTime() - card.due.getTime()).toBeLessThan(DAY);
  });

  it("should move remembered further out than vaguely", () => {
    const card = reviewCard();

    const vaguely = nextSchedule(card, "vaguely", card.due);
    const remembered = nextSchedule(card, "remembered", card.due);

    expect(remembered.schedule.due.getTime()).toBeGreaterThan(
      vaguely.schedule.due.getTime(),
    );
    expect(remembered.scheduledDays).toBeGreaterThan(vaguely.scheduledDays);
    expect(vaguely.schedule.lapses).toBe(card.lapses);
  });

  it("should report the days since the last review", () => {
    const card = reviewCard();
    const now = new Date(card.due.getTime() + 3 * DAY);

    const { elapsedDays } = nextSchedule(card, "remembered", now);

    expect(elapsedDays).toBeGreaterThanOrEqual(3);
  });

  it("should report 0 elapsed days when the card was never reviewed", () => {
    expect(nextSchedule(newCard, "remembered", start).elapsedDays).toBe(0);
  });
});

describe("nextSchedule results", () => {
  it("should not depend on scheduled_days, which is not stored", () => {
    const scheduler = fsrs({ enable_fuzz: false, enable_short_term: true });
    const card = reviewCard();
    const input = {
      due: card.due,
      stability: card.stability,
      difficulty: card.difficulty,
      learning_steps: card.learningSteps,
      reps: card.reps,
      lapses: card.lapses,
      state: "Review" as const,
      last_review: card.lastReview ?? undefined,
    };
    const later = new Date(card.due.getTime() + 2 * DAY);

    const run = (scheduledDays: number) =>
      scheduler.next(
        { ...input, scheduled_days: scheduledDays },
        later,
        Rating.Good,
      ).card;

    expect(run(0)).toEqual(run(30));
  });

  it("should give the same result when the same rating runs twice", () => {
    const card = reviewCard();

    expect(nextSchedule(card, "remembered", card.due)).toEqual(
      nextSchedule(card, "remembered", card.due),
    );
  });

  it("should not change the schedule it receives", () => {
    const before = { ...newCard };

    nextSchedule(newCard, "remembered", start);

    expect(newCard).toEqual(before);
  });
});
