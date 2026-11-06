export default function SettingsLoading() {
  return (
    <div aria-busy="true" className="flex flex-col gap-4">
      <div className="h-9 w-40 animate-pulse rounded-md bg-muted" />
      <div className="h-80 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}
