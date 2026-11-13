export function FormSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="h-10 animate-pulse rounded-pill bg-neutral-100" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <div className="h-3 w-20 animate-pulse rounded bg-neutral-100" />
          <div className="h-10 animate-pulse rounded-md bg-neutral-100" />
        </div>
      ))}
      <div className="h-11 animate-pulse rounded-pill bg-neutral-200" />
      <div className="mx-auto h-3 w-40 animate-pulse rounded bg-neutral-100" />
    </div>
  );
}
