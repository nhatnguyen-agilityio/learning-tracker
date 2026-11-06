const PLACEHOLDER_ROWS = [0, 1, 2, 3];

export default function CardsLoading() {
  return (
    <div aria-busy="true" className="flex flex-col gap-4">
      <div className="h-9 w-40 animate-pulse rounded-md bg-muted" />
      <div className="flex flex-col gap-2">
        {PLACEHOLDER_ROWS.map((row) => (
          <div key={row} className="h-16 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  );
}
