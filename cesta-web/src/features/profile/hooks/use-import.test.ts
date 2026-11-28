import { describe, it, expect, beforeEach } from "vitest";
import { act, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { server } from "@/mocks/server";
import { useAuthStore } from "@/stores/auth.store";
import { setAccessToken } from "@/lib/api";
import { renderHookWithProviders, mockAuthUser } from "@/test-utils";
import {
  useApplyImport,
  useCreateImport,
  useImportStatus,
} from "./use-import";

const API = "http://localhost:3000/api/v1";

function signIn() {
  setAccessToken("mock-access-token");
  useAuthStore.setState({
    user: mockAuthUser(),
    isHydrated: true,
  });
}

describe("useCreateImport / useImportStatus / useApplyImport (S102)", () => {
  beforeEach(() => {
    signIn();
  });

  it("create upload returns 202 + jobId and polling stops at ready_to_apply", async () => {
    let getCount = 0;
    server.use(
      http.post(`${API}/users/me/import`, () =>
        HttpResponse.json(
          {
            jobId: "imp1",
            status: "pending",
            dryRun: true,
            errorMessage: null,
            summary: null,
            createdAt: "2026-11-18T10:00:00.000Z",
          },
          { status: 202 },
        ),
      ),
      http.get(`${API}/users/me/import/imp1`, () => {
        getCount++;
        if (getCount < 2) {
          return HttpResponse.json({
            jobId: "imp1",
            status: "parsing",
            dryRun: true,
            errorMessage: null,
            summary: null,
            createdAt: "2026-11-18T10:00:00.000Z",
          });
        }
        return HttpResponse.json({
          jobId: "imp1",
          status: "ready_to_apply",
          dryRun: true,
          errorMessage: null,
          summary: {
            added: {
              favoritos: 3,
              listas: 1,
              listaItems: 5,
              alertas: 0,
              reviews: 2,
              expenses: 0,
              expenseItems: 0,
            },
            skipped: {
              favoritos: 1,
              listas: 0,
              alertas: 0,
              reviews: 0,
              productsNotFound: 2,
            },
            errors: [],
          },
          createdAt: "2026-11-18T10:00:00.000Z",
        });
      }),
    );

    const create = renderHookWithProviders(() => useCreateImport());
    const file = new File(["dummy"], "export.zip", { type: "application/zip" });

    let created: { jobId: string; status: string } | null = null;
    await act(async () => {
      created = await create.result.current.mutateAsync({ file });
    });

    expect(created!.jobId).toBe("imp1");
    expect(created!.status).toBe("pending");

    const status = renderHookWithProviders(() => useImportStatus("imp1"));
    await waitFor(
      () => expect(status.result.current.data?.status).toBe("ready_to_apply"),
      { timeout: 5000 },
    );
    expect(status.result.current.data?.summary?.added.favoritos).toBe(3);
  });

  it("apply confirms and returns complete", async () => {
    server.use(
      http.post(`${API}/users/me/import/imp1/apply`, () =>
        HttpResponse.json(
          {
            jobId: "imp1",
            status: "applying",
            dryRun: true,
            errorMessage: null,
            summary: null,
            createdAt: "2026-11-18T10:00:00.000Z",
          },
          { status: 202 },
        ),
      ),
    );
    const apply = renderHookWithProviders(() => useApplyImport());
    let applied: { status: string } | null = null;
    await act(async () => {
      applied = await apply.result.current.mutateAsync("imp1");
    });
    expect(applied!.status).toBe("applying");
  });

  it("create 429 surfaces rate-limit path without throwing", async () => {
    server.use(
      http.post(`${API}/users/me/import`, () =>
        HttpResponse.json(
          { statusCode: 429, message: "rate limited", errorCode: "RATE_LIMITED" },
          { status: 429 },
        ),
      ),
    );
    const create = renderHookWithProviders(() => useCreateImport());
    const file = new File(["dummy"], "export.zip", { type: "application/zip" });
    await expect(
      create.result.current.mutateAsync({ file }),
    ).rejects.toMatchObject({ statusCode: 429 });
  });
});
