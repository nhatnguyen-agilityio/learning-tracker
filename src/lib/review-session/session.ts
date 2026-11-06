import type { ReviewRating } from "@/domain/fsrs";

type SessionItem<Card> = { card: Card; again: boolean };

export type ReviewSessionState<Card> = {
  items: SessionItem<Card>[];
  position: number;
  /** The rating that can still be undone. */
  last: { idempotencyKey: string; appended: boolean } | null;
};

export function startSession<Card>(cards: Card[]): ReviewSessionState<Card> {
  return {
    items: cards.map((card) => ({ card, again: false })),
    position: 0,
    last: null,
  };
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
export function rateCurrent<Card>(
  state: ReviewSessionState<Card>,
  rating: ReviewRating,
  idempotencyKey: string,
): ReviewSessionState<Card> {
  const item = currentItem(state);
  if (!item) return state;

  const appended = rating === "forgot";
  return {
    items: appended
      ? [...state.items, { card: item.card, again: true }]
      : state.items,
    position: state.position + 1,
    last: { idempotencyKey, appended },
  };
}

/** Goes back to the rated card; only the latest rating can be undone. */
export function undoLast<Card>(
  state: ReviewSessionState<Card>,
): ReviewSessionState<Card> {
  if (!state.last) return state;

  return {
    items: state.last.appended ? state.items.slice(0, -1) : state.items,
    position: state.position - 1,
    last: null,
  };
}
