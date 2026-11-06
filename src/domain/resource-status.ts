export const RESOURCE_STATUSES = ["want", "learning", "done"] as const;

export type ResourceStatus = (typeof RESOURCE_STATUSES)[number];

export function isResourceStatus(value: string): value is ResourceStatus {
  return (RESOURCE_STATUSES as readonly string[]).includes(value);
}

export function isValidProgress(progress: number) {
  return Number.isInteger(progress) && progress >= 0 && progress <= 100;
}

/** Progress above 0 moves "Want to learn" to "Learning" (SPEC.md, F3). */
export function statusAfterProgress(
  status: ResourceStatus,
  progress: number,
): ResourceStatus {
  return status === "want" && progress > 0 ? "learning" : status;
}

/** At 100%, the app suggests "Done" but never changes it alone (SPEC.md, F3). */
export function shouldSuggestDone(status: ResourceStatus, progress: number) {
  return progress === 100 && status !== "done";
}
