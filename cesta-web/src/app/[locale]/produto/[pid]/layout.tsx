// Sprint 88 gate 4: metadata (title/description/openGraph/twitter/canonical)
// movida pra page.tsx onde fetchProductSSR resolve o produto. Layout vira
// pass-through.
export default function ProdutoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
