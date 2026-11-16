export default function Loading() {
  return (
    <main className="pb-24">
      <div className="sticky top-0 z-10 flex h-14 items-center gap-3 bg-cream px-4 py-3">
        <div className="h-9 w-9 animate-pulse rounded-full bg-neutral-200" />
        <div className="h-5 flex-1 animate-pulse rounded bg-neutral-200" />
        <div className="h-8 w-24 animate-pulse rounded-pill bg-neutral-200" />
      </div>
      <div className="px-4 pt-2 space-y-2">
        <div className="h-9 w-full animate-pulse rounded-pill bg-neutral-200" />
      </div>
      <ul className="px-4 pt-3 space-y-3">
        <li className="h-24 animate-pulse rounded-card bg-surface" />
        <li className="h-24 animate-pulse rounded-card bg-surface" />
        <li className="h-24 animate-pulse rounded-card bg-surface" />
        <li className="h-24 animate-pulse rounded-card bg-surface" />
      </ul>
    </main>
  );
}
