import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./src/mocks/server";

// bypass pra OPTIONS preflight não-handleado em jsdom cross-origin + evita
// ruído em warns. Requests sem handler explícito passam silent — testes que
// precisam de handler específico já declaram via server.use().
// msw v3 SharedOptions tipo mal exposto via type-fest PartialObjectDeep.
beforeAll(() =>
  server.listen({
    onUnhandledRequest: "bypass",
  } as Parameters<typeof server.listen>[0]),
);
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
