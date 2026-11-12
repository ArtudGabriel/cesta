"use client";

interface HighlightedTextProps {
  text: string;
  highlight?: string | null;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function HighlightedText({ text, highlight }: HighlightedTextProps) {
  const needle = highlight?.trim();
  if (!needle) return <>{text}</>;
  const splitter = new RegExp(`(${escapeRegex(needle)})`, "gi");
  const matcher = new RegExp(`^${escapeRegex(needle)}$`, "i");
  const parts = text.split(splitter);
  return (
    <>
      {parts.map((part, i) =>
        matcher.test(part) ? (
          <mark
            key={i}
            className="rounded px-0.5 bg-lima/40 text-cesta-green-dark font-semibold"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
