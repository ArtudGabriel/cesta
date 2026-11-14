/**
 * Placeholder usado como Suspense fallback do LocalizedShell (layout root).
 * Cesta tokens only: bg cream, divisores neutral, nav items 44x44 (WCAG touch),
 * zero cor inventada. Desbloqueia `cacheComponents: true` isolando dynamic
 * data access (getLocale/getMessages) numa boundary stream.
 */
export function LayoutSkeleton() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-cream">
      <div className="flex h-14 items-center gap-3 border-b border-neutral-200 bg-white/60 px-4">
        <div className="h-8 w-8 animate-pulse rounded-full bg-neutral-200" />
        <div className="h-5 flex-1 animate-pulse rounded bg-neutral-200" />
      </div>
      <div className="flex-1 space-y-3 px-4 py-6">
        <div className="h-6 w-1/3 animate-pulse rounded bg-neutral-200" />
        <div className="h-24 w-full animate-pulse rounded-card bg-neutral-200" />
        <div className="h-24 w-full animate-pulse rounded-card bg-neutral-200" />
      </div>
      <div
        role="presentation"
        aria-hidden
        className="flex h-16 items-center justify-around border-t border-neutral-200 bg-white"
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-11 w-11 animate-pulse rounded-full bg-neutral-200"
          />
        ))}
      </div>
    </div>
  );
}
