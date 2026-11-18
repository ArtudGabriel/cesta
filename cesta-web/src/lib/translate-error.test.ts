import { describe, it, expect } from "vitest";
import { ApiError } from "./api";
import { translateError } from "./translate-error";

type TFn = ((key: string) => string) & { has?: (key: string) => boolean };

function makeT(keys: Record<string, string>): TFn {
  const t: TFn = (key: string) => {
    if (!(key in keys)) throw new Error(`MISSING_MESSAGE: ${key}`);
    return keys[key];
  };
  t.has = (key: string) => key in keys;
  return t;
}

describe("translateError", () => {
  it("ApiError com errorCode conhecido → tradução i18n", () => {
    const err = new ApiError("backend raw msg", "AUTH.INVALID_CREDENTIALS", 401);
    const t = makeT({
      "auth.invalidCredentials": "Credenciales inválidas",
      fallback: "Ocurrió un error",
    });
    expect(translateError(err, t as never)).toBe("Credenciales inválidas");
  });

  it("ApiError sem errorCode (404 Nest default) → fallback, não vaza path cru", () => {
    const err = new ApiError(
      "Cannot POST /api/v1/users/me/import",
      undefined,
      404,
    );
    const t = makeT({ fallback: "Ocurrió un error" });
    expect(translateError(err, t as never)).toBe("Ocurrió un error");
  });

  it("ApiError com errorCode desconhecido (sem chave i18n) → fallback, não vaza msg backend", () => {
    const err = new ApiError("raw backend text", "UNKNOWN.THING", 500);
    const t = makeT({ fallback: "Ocurrió un error" });
    expect(translateError(err, t as never)).toBe("Ocurrió un error");
  });

  it("Error JS puro (não-ApiError) → expõe message (bug de código, não resposta backend)", () => {
    const err = new Error("boom");
    const t = makeT({ fallback: "Ocurrió un error" });
    expect(translateError(err, t as never)).toBe("boom");
  });

  it("não-Error (string, null) → fallback", () => {
    const t = makeT({ fallback: "Ocurrió un error" });
    expect(translateError("string err", t as never)).toBe("Ocurrió un error");
    expect(translateError(null, t as never)).toBe("Ocurrió un error");
  });
});
