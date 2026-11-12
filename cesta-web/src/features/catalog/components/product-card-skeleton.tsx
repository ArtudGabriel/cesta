export function ProductCardSkeleton() {
  return (
    <div
      className="flex items-center gap-3 rounded-card bg-white p-3 shadow-sm"
      role="presentation"
      aria-hidden="true"
    >
      <div className="h-16 w-16 flex-shrink-0 rounded-md bg-neutral-200 animate-pulse" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-4 w-3/4 rounded bg-neutral-200 animate-pulse" />
        <div className="h-3 w-1/3 rounded bg-neutral-200 animate-pulse" />
        <div className="h-5 w-24 rounded bg-neutral-200 animate-pulse" />
      </div>
    </div>
  );
}
