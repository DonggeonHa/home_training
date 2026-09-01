import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "jsdom",
    exclude: ["src/**/*.spec.ts", "node_modules/**", "dist/**"],
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/*.spec.ts",
        "src/main.tsx",
        "src/test/**",
        "src/vite-env.d.ts",
      ],
      include: ["src/**/*.{ts,tsx}"],
    },
  },
})
