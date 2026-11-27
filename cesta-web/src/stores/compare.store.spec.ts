import { beforeEach, describe, expect, it } from "vitest";
import { COMPARE_MAX, useCompareStore } from "./compare.store";

describe("useCompareStore (Sprint 239 #12)", () => {
  beforeEach(() => {
    useCompareStore.setState({ ids: [], isHydrated: false });
    localStorage.clear();
  });

  it("add insere id novo", () => {
    useCompareStore.getState().add("p1");
    expect(useCompareStore.getState().ids).toEqual(["p1"]);
  });

  it("add idempotente — duplicado ignorado", () => {
    useCompareStore.getState().add("p1");
    useCompareStore.getState().add("p1");
    expect(useCompareStore.getState().ids).toEqual(["p1"]);
  });

  it("add respeita COMPARE_MAX (4) — quinto ignorado", () => {
    for (let i = 1; i <= COMPARE_MAX + 2; i++) {
      useCompareStore.getState().add(`p${i}`);
    }
    expect(useCompareStore.getState().ids).toHaveLength(COMPARE_MAX);
    expect(useCompareStore.getState().ids).toEqual(["p1", "p2", "p3", "p4"]);
  });

  it("remove tira id existente sem mexer no resto", () => {
    useCompareStore.getState().setIds(["p1", "p2", "p3"]);
    useCompareStore.getState().remove("p2");
    expect(useCompareStore.getState().ids).toEqual(["p1", "p3"]);
  });

  it("remove em id ausente no-op", () => {
    useCompareStore.getState().setIds(["p1"]);
    useCompareStore.getState().remove("nope");
    expect(useCompareStore.getState().ids).toEqual(["p1"]);
  });

  it("toggle inclui ausente, remove presente", () => {
    useCompareStore.getState().toggle("p1");
    expect(useCompareStore.getState().ids).toEqual(["p1"]);
    useCompareStore.getState().toggle("p1");
    expect(useCompareStore.getState().ids).toEqual([]);
  });

  it("toggle não ultrapassa COMPARE_MAX", () => {
    useCompareStore.getState().setIds(["p1", "p2", "p3", "p4"]);
    useCompareStore.getState().toggle("p5");
    expect(useCompareStore.getState().ids).toEqual(["p1", "p2", "p3", "p4"]);
  });

  it("setIds dedup + corta em COMPARE_MAX + descarta vazios", () => {
    useCompareStore
      .getState()
      .setIds(["p1", "p1", "", "p2", "p3", "p4", "p5"]);
    expect(useCompareStore.getState().ids).toEqual([
      "p1",
      "p2",
      "p3",
      "p4",
    ]);
  });

  it("clear zera", () => {
    useCompareStore.getState().setIds(["p1", "p2"]);
    useCompareStore.getState().clear();
    expect(useCompareStore.getState().ids).toEqual([]);
  });

  it("persist escreve em localStorage no namespace cesta-compare-v1", () => {
    useCompareStore.getState().setIds(["p1", "p2"]);
    const raw = localStorage.getItem("cesta-compare-v1");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string);
    expect(parsed.state.ids).toEqual(["p1", "p2"]);
  });
});
