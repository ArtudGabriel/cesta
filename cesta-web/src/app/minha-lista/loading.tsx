export default function Loading() {
  return (
    <main className="flex-1 pb-16">
      <div className="sticky top-0 z-10 flex items-center gap-3 bg-cream px-4 py-3">
        <div className="h-9 w-9 animate-pulse rounded-full bg-neutral-200" />
        <div className="h-6 w-32 animate-pulse rounded bg-neutral-200" />
      </div>
      <div className="px-4 py-4">
        <div className="h-11 w-full animate-pulse rounded-btn bg-neutral-200" />
      </div>
      <ul className="px-4 space-y-3">
        <li className="h-20 animate-pulse rounded-card bg-surface" />
        <li className="h-20 animate-pulse rounded-card bg-surface" />
        <li className="h-20 animate-pulse rounded-card bg-surface" />
      </ul>
    </main>
  );
}
