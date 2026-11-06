/** A link in a note keeps its address only when it is http or https. */
export function safeNoteLink(url: string) {
  return /^https?:\/\//i.test(url) ? url : undefined;
}
