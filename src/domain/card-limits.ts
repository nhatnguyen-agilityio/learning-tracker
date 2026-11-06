export const MAX_CARDS_PER_USER = 10000;
export const MAX_CARD_SIDE_BYTES = 10 * 1024;

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
