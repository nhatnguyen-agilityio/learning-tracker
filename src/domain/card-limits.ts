export const MAX_CARDS_PER_USER = 10000;
export const MAX_CARD_SIDE_BYTES = 10 * 1024;
export const CARDS_PAGE_SIZE = 100;
export const MAX_CARDS_PER_CALL = 50;

export type CardSideError = "empty" | "too_large" | null;

export type CardErrors = { front: CardSideError; back: CardSideError };

function sideError(text: string): CardSideError {
  if (!text.trim()) return "empty";
  const bytes = new TextEncoder().encode(text).length;
  return bytes > MAX_CARD_SIDE_BYTES ? "too_large" : null;
}

/** Returns null when both sides can be saved. */
export function validateCard(sides: {
  front: string;
  back: string;
}): CardErrors | null {
  const errors = { front: sideError(sides.front), back: sideError(sides.back) };
  return errors.front || errors.back ? errors : null;
}

/** Reads "?show=" from the Cards screen; anything odd means the first page. */
export function parseCardsShown(value: string | string[] | undefined) {
  const shown = Number(value);
  if (!Number.isInteger(shown) || shown < CARDS_PAGE_SIZE) {
    return CARDS_PAGE_SIZE;
  }
  return Math.min(shown, MAX_CARDS_PER_USER);
}
