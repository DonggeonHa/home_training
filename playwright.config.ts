import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./src",
  testIgnore: ["features/dashboard/todo11-visual-qa.spec.ts"],
  testMatch: "**/*.spec.ts",
  use: {
    baseURL: "http://127.0.0.1:4190",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: devices["Desktop Chrome"],
    },
  ],
  webServer: {
    command: "pnpm exec vite preview --host 127.0.0.1 --port 4190 --strictPort",
    reuseExistingServer: false,
    url: "http://127.0.0.1:4190",
  },
})
