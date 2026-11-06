import { fsrs, Rating, type State } from "ts-fsrs";

/** The 3 ratings in the app; Easy stays hidden (SPEC.md, "Review schedule"). */
export type ReviewRating = "forgot" | "vaguely" | "remembered";

const GRADES = {
  forgot: Rating.Again,
  vaguely: Rating.Hard,
  remembered: Rating.Good,
} as const;

export type CardSchedule = {
  due: Date;
  stability: number;
  difficulty: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: number;
  lastReview: Date | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

// Learning steps bring Forgot cards back within the session. Fuzz stays off so
// the same rating always gives the same date.
const scheduler = fsrs({ enable_fuzz: false, enable_short_term: true });

export function nextSchedule(
  schedule: CardSchedule,
  rating: ReviewRating,
  now: Date,
) {
  const { card } = scheduler.next(
    {
      due: schedule.due,
      stability: schedule.stability,
      difficulty: schedule.difficulty,
      scheduled_days: 0,
      learning_steps: schedule.learningSteps,
      reps: schedule.reps,
      lapses: schedule.lapses,
      state: schedule.state as State,
      last_review: schedule.lastReview ?? undefined,
    },
    now,
    GRADES[rating],
  );

  return {
    schedule: {
      due: card.due,
      stability: card.stability,
      difficulty: card.difficulty,
      learningSteps: card.learning_steps,
      reps: card.reps,
      lapses: card.lapses,
      state: card.state as number,
      lastReview: card.last_review ?? now,
    } satisfies CardSchedule,
    scheduledDays: card.scheduled_days,
    elapsedDays: schedule.lastReview
      ? Math.floor((now.getTime() - schedule.lastReview.getTime()) / DAY_MS)
      : 0,
  };
}
