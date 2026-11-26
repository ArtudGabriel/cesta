import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.{test,spec}.{ts,tsx}",
        "src/mocks/**",
        "src/test-utils.tsx",
        "src/**/*.d.ts",
        "src/app/**/layout.tsx",
        "src/app/**/loading.tsx",
        "src/app/**/not-found.tsx",
      ],
      // Sprint 194 (S71 nit close) — coverage threshold gate rebased.
      // Baseline capturado 2026-11-26 full test suite:
      //   statements 35.28% / branches 29.75% / functions 30.3% / lines 35.81%.
      // Thresholds -2pp pra absorver flutuação CI vs local + feature sprints
      // sem over-tightening (incrementar via README procedure quando baseline
      // subir ≥5pp acima do threshold).
      thresholds: {
        statements: 33,
        branches: 27,
        functions: 28,
        lines: 33,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
