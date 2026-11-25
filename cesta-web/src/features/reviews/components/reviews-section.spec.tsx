import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils";
import { ReviewsSection } from "./reviews-section";
import type { Review, ReviewSummary } from "../types/review.types";

const useAuthStoreMock = vi.fn();
vi.mock("@/stores/auth.store", () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector(useAuthStoreMock()),
}));

const useReviewSummaryMock = vi.fn();
const useProductReviewsMock = vi.fn();
const useMyReviewMock = vi.fn();
vi.mock("../hooks/use-reviews", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../hooks/use-reviews")>();
  return {
    ...actual,
    useReviewSummary: (...args: unknown[]) => useReviewSummaryMock(...args),
    useProductReviews: (...args: unknown[]) => useProductReviewsMock(...args),
    useMyReview: (...args: unknown[]) => useMyReviewMock(...args),
    useCreateReview: () => ({ mutate: vi.fn(), isPending: false }),
    useUpdateReview: () => ({ mutate: vi.fn(), isPending: false }),
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/produto/p-1",
}));

function makeReview(overrides: Partial<Review> = {}): Review {
  return {
    id: `r-${Math.random().toString(36).slice(2, 8)}`,
    productId: "p-1",
    rating: 5,
    comment: "Muy bueno",
    helpfulCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    authorId: "u-other",
    authorName: "Alice",
    markedHelpful: false,
    ...overrides,
  };
}

const summary: ReviewSummary = {
  average: 4.3,
  total: 10,
  distribution: { 1: 1, 2: 0, 3: 2, 4: 3, 5: 4 },
};

describe("ReviewsSection (Sprint 172)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStoreMock.mockReturnValue({
      user: { id: "u-me" },
      isHydrated: true,
    });
    useReviewSummaryMock.mockReturnValue({ data: summary });
    useMyReviewMock.mockReturnValue({ data: null });
  });

  it("renderiza summary avg + sort select + filter checkbox", () => {
    useProductReviewsMock.mockReturnValue({
      data: { items: [makeReview()], total: 1 },
      isLoading: false,
    });
    const { getByTestId, getByText } = renderWithProviders(
      <ReviewsSection productId="p-1" />,
    );
    expect(getByText("4.3")).toBeTruthy();
    expect(getByTestId("reviews-sort-select")).toBeTruthy();
    expect(getByTestId("reviews-filter-comments-only")).toBeTruthy();
  });

  it("filter commentsOnly=true esconde reviews sem comment", () => {
    useProductReviewsMock.mockReturnValue({
      data: {
        items: [
          makeReview({ id: "r-with", comment: "Tem comentário" }),
          makeReview({ id: "r-without", comment: null }),
          makeReview({ id: "r-empty", comment: "   " }),
        ],
        total: 3,
      },
      isLoading: false,
    });
    const { getByTestId, queryByText, getByText } = renderWithProviders(
      <ReviewsSection productId="p-1" />,
    );
    // Sem filter: ambos (apenas o com comentário tem texto renderizado visível)
    expect(getByText("Tem comentário")).toBeTruthy();
    // Toggle filter
    fireEvent.click(getByTestId("reviews-filter-comments-only"));
    // Reviews sem comment são filtered — "r-without" + "r-empty" removed
    expect(getByText("Tem comentário")).toBeTruthy();
    // Indireto: lista ainda renderiza mas apenas 1 item passa
    expect(queryByText("Ainda sem opiniões.")).toBeNull();
  });

  it("filter commentsOnly=true + zero reviews com comment → emptyListFiltered", () => {
    useProductReviewsMock.mockReturnValue({
      data: {
        items: [
          makeReview({ comment: null }),
          makeReview({ comment: "   " }),
        ],
        total: 2,
      },
      isLoading: false,
    });
    const { getByTestId, getByText } = renderWithProviders(
      <ReviewsSection productId="p-1" />,
    );
    fireEvent.click(getByTestId("reviews-filter-comments-only"));
    expect(
      getByText("Ninguna opinión con comentario todavía."),
    ).toBeTruthy();
  });

  it("anon user: LoginGate CTA aparece ao invés do form", () => {
    useAuthStoreMock.mockReturnValue({ user: null, isHydrated: true });
    useProductReviewsMock.mockReturnValue({
      data: { items: [], total: 0 },
      isLoading: false,
    });
    const { getByText } = renderWithProviders(
      <ReviewsSection productId="p-1" />,
    );
    // loginPrefix text "Inicia sesión" presente
    expect(getByText(/Inicia sesión/)).toBeTruthy();
  });
});
