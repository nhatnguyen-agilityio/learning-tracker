export const MIN_NEW_CARDS_PER_DAY = 0;
export const MAX_NEW_CARDS_PER_DAY = 100;

export function isValidNewCardsPerDay(value: number) {
  return (
    Number.isInteger(value) &&
    value >= MIN_NEW_CARDS_PER_DAY &&
    value <= MAX_NEW_CARDS_PER_DAY
  );
}
