export default function Loading() {
  return (
    <main className="flex-1 pb-16">
      <div className="sticky top-0 z-10 flex h-14 items-center gap-3 bg-cream px-4 py-3">
        <div className="h-9 w-9 animate-pulse rounded-full bg-neutral-200" />
        <div className="h-5 flex-1 animate-pulse rounded bg-neutral-200" />
        <div className="h-9 w-9 animate-pulse rounded-full bg-neutral-200" />
      </div>
      <div className="px-4 py-2">
        <div className="h-11 w-full animate-pulse rounded-btn bg-neutral-200" />
      </div>
      <div className="px-4 py-4 space-y-2">
        <div className="h-5 w-1/3 animate-pulse rounded bg-neutral-200" />
        <div className="h-16 w-full animate-pulse rounded-card bg-neutral-200" />
        <div className="h-16 w-full animate-pulse rounded-card bg-neutral-200" />
        <div className="h-16 w-full animate-pulse rounded-card bg-neutral-200" />
        <div className="h-16 w-full animate-pulse rounded-card bg-neutral-200" />
        <div className="h-16 w-full animate-pulse rounded-card bg-neutral-200" />
      </div>
    </main>
  );
}
