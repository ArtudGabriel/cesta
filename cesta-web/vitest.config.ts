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
      // Baseline Sprint 43 — medido primeira run coverage (atual - 5pp buffer).
      // Baseline: statements 11.81% / branches 5.37% / functions 9.5% / lines 11.71%.
      // Thresholds propositalmente baixos pra passar hoje; incrementar sprints futuras.
      thresholds: {
        statements: 6,
        branches: 3,
        functions: 4,
        lines: 6,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
