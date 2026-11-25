export function AlertRuleCardSkeleton() {
  return (
    <div
      className="rounded-card bg-white p-4 shadow-card"
      role="presentation"
      aria-hidden="true"
      data-testid="alert-rule-card-skeleton"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-4 w-1/2 rounded bg-neutral-200 animate-pulse" />
          <div className="h-3 w-3/4 rounded bg-neutral-200 animate-pulse" />
        </div>
        <div className="flex flex-col gap-1">
          <div className="h-8 w-8 rounded-btn bg-neutral-200 animate-pulse" />
          <div className="h-8 w-8 rounded-btn bg-neutral-200 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
