export function AlertCardSkeleton() {
  return (
    <div
      className="rounded-card bg-white p-3 shadow-card"
      role="presentation"
      aria-hidden="true"
      data-testid="alert-card-skeleton"
    >
      <div className="flex items-start gap-3">
        <div className="h-14 w-14 flex-shrink-0 rounded-btn bg-neutral-200 animate-pulse" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-4 w-4/5 rounded bg-neutral-200 animate-pulse" />
          <div className="h-3 w-1/3 rounded bg-neutral-200 animate-pulse" />
          <div className="h-5 w-24 rounded-pill bg-neutral-200 animate-pulse" />
        </div>
        <div className="flex flex-col gap-1">
          <div className="h-8 w-8 rounded-btn bg-neutral-200 animate-pulse" />
          <div className="h-8 w-8 rounded-btn bg-neutral-200 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
