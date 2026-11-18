import { describe, expect, it } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils";
import { AuditLogCard } from "./audit-log-card";
import type { AuditLogItem } from "../types/audit";

function makeItem(overrides: Partial<AuditLogItem> = {}): AuditLogItem {
  return {
    id: "al-1",
    userId: "u-abc",
    actorId: null,
    type: "UserDataExported",
    metadata: { bytes: 1234, files: 5 },
    createdAt: "2026-11-18T10:00:00.000Z",
    ...overrides,
  };
}

describe("AuditLogCard (Sprint 104)", () => {
  it("renderiza type badge + userId + createdAt", () => {
    const { getByText, container } = renderWithProviders(
      <AuditLogCard item={makeItem()} />,
    );
    expect(getByText(/Datos exportados/i)).toBeTruthy();
    expect(getByText("u-abc")).toBeTruthy();
    expect(container.querySelector("time")?.getAttribute("datetime")).toBe(
      "2026-11-18T10:00:00.000Z",
    );
  });

  it("GDPR: wrapper tem data-sentry-mask; chrome público (badge, time) tem unmask", () => {
    const { container } = renderWithProviders(
      <AuditLogCard item={makeItem()} />,
    );
    const article = container.querySelector("article");
    expect(article?.hasAttribute("data-sentry-mask")).toBe(true);
    const unmasked = container.querySelectorAll("[data-sentry-unmask]");
    expect(unmasked.length).toBeGreaterThanOrEqual(2);
  });

  it("metadata colapsado por default, expande on click", () => {
    const { getByRole, queryByText } = renderWithProviders(
      <AuditLogCard item={makeItem()} />,
    );
    expect(queryByText(/"bytes"/)).toBeNull();
    const toggle = getByRole("button", { name: /ver metadatos/i });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(queryByText(/"bytes"/)).toBeTruthy();
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
  });

  it("sem metadata não renderiza toggle", () => {
    const { queryByRole } = renderWithProviders(
      <AuditLogCard item={makeItem({ metadata: null })} />,
    );
    expect(queryByRole("button", { name: /ver metadatos/i })).toBeNull();
  });

  it("mostra actorId quando diferente de userId", () => {
    const { getByText } = renderWithProviders(
      <AuditLogCard
        item={makeItem({
          type: "AdminCancelledDelete",
          userId: "u-target",
          actorId: "u-admin",
        })}
      />,
    );
    expect(getByText("u-target")).toBeTruthy();
    expect(getByText("u-admin")).toBeTruthy();
  });

  it("não renderiza actorId quando igual ao userId (evita ruído visual)", () => {
    const { queryAllByText } = renderWithProviders(
      <AuditLogCard item={makeItem({ actorId: "u-abc" })} />,
    );
    expect(queryAllByText("u-abc")).toHaveLength(1);
  });
});
