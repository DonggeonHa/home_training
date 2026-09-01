import { defineConfig, devices } from "@playwright/test"

// biome-ignore lint/style/noDefaultExport: Playwright config files use a default config export.
export default defineConfig({
  testDir: ".",
  testMatch: "todo11-visual-qa.spec.ts",
  use: {
    baseURL: "http://127.0.0.1:4174",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: devices["Desktop Chrome"],
    },
  ],
  webServer: {
    command: "pnpm exec vite --host 127.0.0.1 --port 4174 --strictPort --clearScreen false",
    cwd: process.cwd(),
    reuseExistingServer: true,
    timeout: 120_000,
    url: "http://127.0.0.1:4174",
  },
})
