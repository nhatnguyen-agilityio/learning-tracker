export default function TodayLoading() {
  return (
    <div aria-busy="true" className="flex flex-col gap-4">
      <div className="h-14 w-48 animate-pulse rounded-md bg-muted" />
      <div className="h-44 animate-pulse rounded-lg bg-muted" />
      <div className="h-14 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}
