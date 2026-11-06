export const MAX_NOTE_BYTES = 100 * 1024;
export const NOTE_WARNING_BYTES = 10 * 1024;

/** Bytes, not characters: Vietnamese letters with accents take more than one. */
export function noteBytes(content: string) {
  return new TextEncoder().encode(content).length;
}

export function isNoteTooLarge(content: string) {
  return noteBytes(content) > MAX_NOTE_BYTES;
}
