import { describe, expect, it, vi, beforeEach } from "vitest";
import { act } from "@testing-library/react";
import { renderHookWithProviders } from "@/test-utils";
import { useSortUnitPreference } from "./use-sort-unit-preference";

const useProfileMock = vi.fn();
const updateMutateMock = vi.fn();

vi.mock("./use-profile", () => ({
  useProfile: () => useProfileMock(),
  useUpdateProfile: () => ({
    mutate: updateMutateMock,
    isPending: false,
  }),
}));

describe("useSortUnitPreference (Sprint 175 fix)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("anon (profile=undefined) default = 'absolute'", () => {
    useProfileMock.mockReturnValue({ data: undefined, isPending: false });
    const { result } = renderHookWithProviders(() => useSortUnitPreference());
    expect(result.current.value).toBe("absolute");
  });

  it("anon setValue → local state atualiza instant + NÃO chama update.mutate (sem profile)", () => {
    useProfileMock.mockReturnValue({ data: undefined, isPending: false });
    const { result } = renderHookWithProviders(() => useSortUnitPreference());
    act(() => result.current.setValue("unit"));
    expect(result.current.value).toBe("unit");
    expect(updateMutateMock).not.toHaveBeenCalled();
  });

  it("logged user profile.sortUnitPreference='unit' → value inicial 'unit'", () => {
    useProfileMock.mockReturnValue({
      data: { sortUnitPreference: "unit" },
      isPending: false,
    });
    const { result } = renderHookWithProviders(() => useSortUnitPreference());
    expect(result.current.value).toBe("unit");
  });

  it("logged setValue → local instant + persist via update.mutate", () => {
    useProfileMock.mockReturnValue({
      data: { sortUnitPreference: "absolute" },
      isPending: false,
    });
    const { result } = renderHookWithProviders(() => useSortUnitPreference());
    act(() => result.current.setValue("unit"));
    expect(result.current.value).toBe("unit");
    expect(updateMutateMock).toHaveBeenCalledWith({ sortUnitPreference: "unit" });
  });

  it("setValue mesmo valor atual → noop (sem mutate, sem re-render)", () => {
    useProfileMock.mockReturnValue({
      data: { sortUnitPreference: "absolute" },
      isPending: false,
    });
    const { result } = renderHookWithProviders(() => useSortUnitPreference());
    act(() => result.current.setValue("absolute"));
    expect(updateMutateMock).not.toHaveBeenCalled();
  });
});
