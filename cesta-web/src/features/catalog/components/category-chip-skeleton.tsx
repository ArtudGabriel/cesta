export function CategoryChipSkeleton({ width = 96 }: { width?: number }) {
  return (
    <span
      role="presentation"
      aria-hidden="true"
      className="inline-block h-10 flex-shrink-0 rounded-pill bg-neutral-200 animate-pulse"
      style={{ width }}
    />
  );
}
