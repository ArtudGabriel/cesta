import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <main className="flex-1 pb-16">
      <div className="sticky top-0 z-10 flex h-14 items-center gap-3 bg-cream px-4 py-3">
        <div className="h-9 w-9 animate-pulse rounded-full bg-neutral-200" />
        <div className="h-5 flex-1 animate-pulse rounded bg-neutral-200" />
      </div>
      <div className="px-4 pb-4">
        <div className="h-48 w-full animate-pulse rounded-card bg-neutral-200" />
        <div className="mt-4 h-6 w-2/3 animate-pulse rounded bg-neutral-200" />
        <div className="mt-2 h-4 w-1/3 animate-pulse rounded bg-neutral-200" />
      </div>
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-cesta-green" />
      </div>
    </main>
  );
}
