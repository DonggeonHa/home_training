import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "jsdom",
    exclude: [
      "**/*.spec.ts",
      ".omo/**",
      "coverage/**",
      "dist/**",
      "node_modules/**",
      "playwright-report/**",
      "test-results/**",
    ],
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      exclude: [
        ".omo/**",
        "coverage/**",
        "dist/**",
        "playwright-report/**",
        "src/**/*.test.{ts,tsx}",
        "src/**/*.spec.ts",
        "src/main.tsx",
        "src/test/**",
        "src/vite-env.d.ts",
        "test-results/**",
      ],
      include: ["src/**/*.{ts,tsx}"],
    },
  },
})
