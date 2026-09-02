import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "jsdom",
    exclude: ["src/**/*.spec.ts", "node_modules/**", "dist/**"],
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      include: [
        "src/domain/catalog/catalog.ts",
        "src/domain/catalog/catalog-gate-validation.ts",
        "src/domain/catalog/catalog-validation.ts",
        "src/domain/catalog/catalog-types.ts",
        "src/domain/catalog/index.ts",
      ],
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        perFile: true,
        statements: 100,
      },
    },
  },
})
