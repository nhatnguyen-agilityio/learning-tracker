export default function ReviewLoading() {
  return (
    <div
      aria-busy="true"
      className="mx-auto flex h-dvh w-full max-w-160 flex-col justify-center gap-4 p-4"
    >
      <div className="h-80 animate-pulse rounded-2xl bg-muted" />
      <div className="h-11 animate-pulse rounded-md bg-muted" />
    </div>
  );
}
