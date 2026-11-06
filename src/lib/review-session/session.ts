import type { ReviewRating } from "@/domain/fsrs";

type SessionItem<Card> = { card: Card; again: boolean };

export type ReviewSessionState<Card> = {
  items: SessionItem<Card>[];
  position: number;
  /** The rating that can still be undone. */
  last: {
    idempotencyKey: string;
    appended: boolean;
    firstOfCard: string | null;
  } | null;
  /** The first rating of each card; these make the recall rate (SPEC.md). */
  firstRatings: Record<string, ReviewRating>;
};

export function startSession<Card extends { id: string }>(
  cards: Card[],
): ReviewSessionState<Card> {
  return {
    items: cards.map((card) => ({ card, again: false })),
    position: 0,
    last: null,
    firstRatings: {},
  };
}

/** A new batch in the same session keeps the results so far. */
export function startNextBatch<Card extends { id: string }>(
  state: ReviewSessionState<Card>,
  cards: Card[],
): ReviewSessionState<Card> {
  return { ...startSession(cards), firstRatings: state.firstRatings };
}

/** Leaves out cards whose rating from a past visit is still being sent. */
export function dropCards<Card extends { id: string }>(
  state: ReviewSessionState<Card>,
  cardIds: string[],
): ReviewSessionState<Card> {
  return {
    ...state,
    items: state.items.filter((item) => !cardIds.includes(item.card.id)),
  };
}

export function currentItem<Card>(state: ReviewSessionState<Card>) {
  return state.items.at(state.position);
}

export function cardsLeft<Card>(state: ReviewSessionState<Card>) {
  return state.items.length - state.position;
}

/** A Forgot card comes back at the end of the session (SPEC.md, F6). */
export function rateCurrent<Card extends { id: string }>(
  state: ReviewSessionState<Card>,
  rating: ReviewRating,
  idempotencyKey: string,
): ReviewSessionState<Card> {
  const item = currentItem(state);
  if (!item) return state;

  const appended = rating === "forgot";
  const isFirst = !Object.hasOwn(state.firstRatings, item.card.id);
  return {
    ...state,
    items: appended
      ? [...state.items, { card: item.card, again: true }]
      : state.items,
    position: state.position + 1,
    last: {
      idempotencyKey,
      appended,
      firstOfCard: isFirst ? item.card.id : null,
    },
    firstRatings: isFirst
      ? { ...state.firstRatings, [item.card.id]: rating }
      : state.firstRatings,
  };
}

/** Goes back to the rated card; only the latest rating can be undone. */
export function undoLast<Card>(
  state: ReviewSessionState<Card>,
): ReviewSessionState<Card> {
  if (!state.last) return state;

  const { firstOfCard } = state.last;
  const firstRatings = { ...state.firstRatings };
  if (firstOfCard) delete firstRatings[firstOfCard];

  return {
    ...state,
    firstRatings,
    items: state.last.appended ? state.items.slice(0, -1) : state.items,
    position: state.position - 1,
    last: null,
  };
}

export type SessionSummary = {
  reviewed: number;
  remembered: number;
  vaguely: number;
  forgot: number;
  recallRate: number;
};

/** Remembered and Vaguely both count as recalled, as in the design. */
export function summarize<Card>(
  state: ReviewSessionState<Card>,
): SessionSummary {
  const ratings = Object.values(state.firstRatings);
  const count = (rating: ReviewRating) =>
    ratings.filter((item) => item === rating).length;
  const forgot = count("forgot");

  return {
    reviewed: ratings.length,
    remembered: count("remembered"),
    vaguely: count("vaguely"),
    forgot,
    recallRate:
      ratings.length === 0
        ? 0
        : Math.round(((ratings.length - forgot) / ratings.length) * 100),
  };
}
