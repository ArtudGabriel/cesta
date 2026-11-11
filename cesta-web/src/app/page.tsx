export default function HomePage() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 text-center">
      <h1 className="font-display text-4xl font-extrabold text-cesta-green">
        Cesta
      </h1>
      <p className="mt-3 max-w-md text-muted">
        Compara precios de supermercado en la Comunidad de Madrid.
        <br />
        <span className="text-sm opacity-70">
          (Layer 1 — infra base pronta. Features chegam nas próximas layers.)
        </span>
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-2 text-xs">
        {[
          "mercadona",
          "carrefour",
          "alcampo",
          "lidl",
          "froiz",
          "dia",
          "aldi",
        ].map((name) => (
          <span
            key={name}
            className="rounded-pill bg-surface px-3 py-1 font-medium text-muted"
          >
            {name}
          </span>
        ))}
      </div>
    </main>
  );
}
