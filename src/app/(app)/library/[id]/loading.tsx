export default function ResourceLoading() {
  return (
    <div aria-busy="true" className="flex flex-col gap-4">
      <div className="flex gap-4">
        <div className="size-24 flex-none animate-pulse rounded-md bg-muted" />
        <div className="h-8 flex-1 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="h-24 animate-pulse rounded-lg bg-muted" />
      <div className="h-24 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}
