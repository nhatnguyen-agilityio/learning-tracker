export type ResourceStatus = "want" | "learning" | "done";

/** Tiến độ lớn hơn 0 thì "Muốn học" tự chuyển sang "Đang học" (SPEC.md, F3). */
export function statusAfterProgress(
  status: ResourceStatus,
  progress: number,
): ResourceStatus {
  return status === "want" && progress > 0 ? "learning" : status;
}
