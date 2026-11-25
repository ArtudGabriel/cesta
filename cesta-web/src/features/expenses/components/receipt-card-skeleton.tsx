export function ReceiptCardSkeleton() {
  return (
    <div
      className="flex items-center gap-3 rounded-card bg-white p-3 shadow-card"
      role="presentation"
      aria-hidden="true"
      data-testid="receipt-card-skeleton"
    >
      <div className="h-10 w-10 flex-shrink-0 rounded-btn bg-neutral-200 animate-pulse" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-4 w-1/2 rounded bg-neutral-200 animate-pulse" />
        <div className="h-3 w-1/3 rounded bg-neutral-200 animate-pulse" />
      </div>
      <div className="h-5 w-16 rounded bg-neutral-200 animate-pulse" />
    </div>
  );
}
