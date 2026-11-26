import { expect, test, type Page } from "@playwright/test";
import {
  baseUser,
  envelope,
  fulfillJson,
  mockMeEndpoints,
  seedAuth,
} from "./helpers/auth";

/**
 * Sprint 203 — E2E /gastos flows.
 *
 * (a) empty state + CTA scan visível.
 * (b) upload nota mock file → POST /receipts retorna 202 {jobId, receiptId,
 *     status} → router.push(/gastos/:receiptId) dispara. Detail page SSR
 *     offline fica em notFound (ok — fora do escopo deste flow); assertion
 *     cobre: upload mutation fired + URL mudou.
 */

async function mockReceiptsList(page: Page, receipts: unknown[] = []) {
  await page.route("**/receipts", async (route) => {
    const method = route.request().method();
    if (method === "GET") {
      await fulfillJson(route, 200, envelope(receipts));
      return;
    }
    if (method === "POST") {
      // multipart/form-data — não parseamos aqui, só confirmamos 202 shape.
      await fulfillJson(route, 202, envelope({
        jobId: "job_abc123",
        receiptId: "crec11111111111111111111111",
        status: "QUEUED",
      }));
      return;
    }
    await route.fallback();
  });
  // Agregados do dashboard — não bloqueiam empty state mas mocks silenciam
  // 404 flapping.
  for (const path of [
    "**/receipts/summary*",
    "**/receipts/by-market*",
    "**/receipts/by-category*",
    "**/receipts/top-products*",
  ]) {
    await page.route(path, (route) => fulfillJson(route, 200, envelope([])));
  }
}

const TINY_JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01,
  0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
]);

test.describe("Gastos flows (route interception)", () => {
  test("(a) /gastos empty state + CTA scan", async ({ page }) => {
    const user = baseUser();
    await seedAuth(page, user);
    await mockMeEndpoints(page, user);
    await mockReceiptsList(page, []);

    await page.goto("/gastos");

    // Empty state: título "Aún no tienes tickets" (ES default).
    await expect(
      page.getByText(/a[uú]n no tienes tickets/i).first(),
    ).toBeVisible({ timeout: 10_000 });

    // ScanButton presente (aria-label "Escanear" via scanCta).
    const scanBtn = page
      .getByRole("button", { name: /escanear|scan/i })
      .first();
    await expect(scanBtn).toBeVisible();
  });

  test("(b) upload nota → POST /receipts 202 + redirect /gastos/:id", async ({
    page,
  }) => {
    const user = baseUser();
    await seedAuth(page, user);
    await mockMeEndpoints(page, user);
    await mockReceiptsList(page, []);

    let uploadHit = false;
    let uploadStatus = 0;
    page.on("response", (resp) => {
      if (
        resp.request().method() === "POST" &&
        resp.url().includes("/receipts")
      ) {
        uploadHit = true;
        uploadStatus = resp.status();
      }
    });

    await page.goto("/gastos");

    // AJUSTE S203 QA: setInputFiles direto em input[type=file].first()
    // falhava — picava file input errado OR não disparava handleFile. Fix:
    // usar filechooser event (padrão Playwright pra ref.click() pattern).
    // Click "Subir imagen" (uploadCta ES) → cameraRef/galleryRef.click() →
    // Playwright intercepta file dialog → setFiles dispara onChange real.
    const uploadBtn = page.getByRole("button", { name: /subir imagen/i });
    await expect(uploadBtn).toBeVisible({ timeout: 10_000 });

    const fileChooserPromise = page.waitForEvent("filechooser");
    await uploadBtn.click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: "ticket.jpg",
      mimeType: "image/jpeg",
      buffer: TINY_JPEG,
    });

    // Preview monta após handleFile → setPending.
    await expect(page.getByTestId("scan-button-preview")).toBeVisible({
      timeout: 10_000,
    });

    // Submit → POST /receipts (mock 202) → router.push(/gastos/:id).
    await page.getByTestId("scan-button-submit").click();

    // URL muda pra /gastos/<receiptId mock>. Detail SSR pode 404 (backend
    // offline); assertion foca no routing + status 202.
    await page.waitForURL(/\/gastos\/crec[a-z0-9]{24,}/, { timeout: 10_000 });

    expect(uploadHit).toBe(true);
    expect(uploadStatus).toBe(202);
  });
});
