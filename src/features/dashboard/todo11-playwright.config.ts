import { defineConfig, devices } from "@playwright/test"

const ciEnvironmentVariable = "CI"

// biome-ignore lint/style/noDefaultExport: Playwright config files use a default config export.
export default defineConfig({
  expect: {
    timeout: 10_000,
  },
  testDir: ".",
  testMatch: "todo11-visual-qa.spec.ts",
  timeout: 90_000,
  use: {
    baseURL: "http://127.0.0.1:4174",
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    video: "retain-on-failure",
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
    reuseExistingServer: process.env[ciEnvironmentVariable] !== "true",
    timeout: 120_000,
    url: "http://127.0.0.1:4174",
  },
})
