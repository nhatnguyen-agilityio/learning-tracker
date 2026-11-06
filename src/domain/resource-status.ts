export type ResourceStatus = "want" | "learning" | "done";

/** Progress above 0 moves "Want to learn" to "Learning" (SPEC.md, F3). */
export function statusAfterProgress(
  status: ResourceStatus,
  progress: number,
): ResourceStatus {
  return status === "want" && progress > 0 ? "learning" : status;
}
