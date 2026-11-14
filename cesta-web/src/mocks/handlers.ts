import { http, HttpResponse } from "msw";

const API = "http://localhost:3001/api/v1";

// Envelope { data: T, meta?: ... } — espelha response shape backend (Sprint 2).
function envelope<T>(data: T) {
  return { data, meta: { timestamp: new Date().toISOString() } };
}

// CORS preflight permissivo pra qualquer path do backend — jsdom simula browser
// e dispara OPTIONS pra "Content-Type: application/json" (non-simple).
const corsOptions = http.options(`${API}/*`, () => {
  return new HttpResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
});

export const handlers = [
  corsOptions,
  // === Auth ===
  http.post(`${API}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string };
    if (body.password === "wrong") {
      return HttpResponse.json(
        {
          statusCode: 401,
          errorCode: "AUTH.INVALID_CREDENTIALS",
          message: "Credenciais inválidas",
          error: "UNAUTHORIZED",
        },
        { status: 401 },
      );
    }
    return HttpResponse.json(
      envelope({
        user: {
          id: "u1",
          email: body.email ?? "test@cesta.app",
          phone: null,
          name: "Test",
          locale: "es",
          roles: ["user"],
          prefersVegan: false,
          prefersVegetarian: false,
          prefersGlutenFree: false,
          prefersLactoseFree: false,
          sortUnitPreference: "absolute",
          nutriSortEnabled: false,
          nutriHealthyOnly: false,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
        tokens: {
          accessToken: "mock-access-token",
          expiresIn: 900,
        },
      }),
    );
  }),

  // === Users ===
  http.get(`${API}/users/me`, ({ request }) => {
    const auth = request.headers.get("authorization");
    if (!auth) {
      return HttpResponse.json(
        {
          statusCode: 401,
          message: "Unauthorized",
          error: "UNAUTHORIZED",
        },
        { status: 401 },
      );
    }
    return HttpResponse.json(
      envelope({
        id: "u1",
        email: "test@cesta.app",
        phone: null,
        name: "Test",
        locale: "es",
        roles: ["user"],
        prefersVegan: false,
        prefersVegetarian: false,
        prefersGlutenFree: false,
        prefersLactoseFree: false,
        sortUnitPreference: "absolute",
        nutriSortEnabled: false,
        nutriHealthyOnly: true,
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    );
  }),

  // === Favorites ===
  http.get(`${API}/favorites`, () => HttpResponse.json(envelope([]))),
  http.post(`${API}/favorites`, async ({ request }) => {
    const body = (await request.json()) as { productId: string };
    return HttpResponse.json(
      envelope({
        id: "f1",
        productId: body.productId,
        createdAt: new Date().toISOString(),
        product: null,
        cheapestPrice: null,
      }),
      { status: 201 },
    );
  }),

  // === Search history ===
  http.get(`${API}/search-history`, () =>
    HttpResponse.json(
      envelope({
        history: [
          {
            id: "h1",
            query: "aceite",
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      }),
    ),
  ),
  http.post(`${API}/search-history`, async ({ request }) => {
    const body = (await request.json()) as { query: string };
    return HttpResponse.json(
      envelope({
        id: "h2",
        query: body.query,
        createdAt: new Date().toISOString(),
      }),
      { status: 201 },
    );
  }),
  http.delete(`${API}/search-history/:q`, () => new HttpResponse(null, { status: 204 })),
  http.delete(`${API}/search-history`, () => new HttpResponse(null, { status: 204 })),
];
