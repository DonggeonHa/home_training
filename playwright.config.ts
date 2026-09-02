import { defineConfig, devices } from "@playwright/test"

const previewPort = readPreviewPort()
const previewUrl = `http://127.0.0.1:${previewPort}`

export default defineConfig({
  testDir: "./src",
  testIgnore: ["features/dashboard/todo11-visual-qa.spec.ts"],
  testMatch: "**/*.spec.ts",
  use: {
    baseURL: previewUrl,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: devices["Desktop Chrome"],
    },
  ],
  webServer: {
    command: `pnpm exec vite preview --host 127.0.0.1 --port ${previewPort} --strictPort`,
    reuseExistingServer: false,
    url: previewUrl,
  },
})

function readPreviewPort(): number {
  const { PLAYWRIGHT_PREVIEW_PORT: configuredPort } = process.env
  if (configuredPort !== undefined) {
    const parsedPort = Number.parseInt(configuredPort, 10)
    if (!Number.isInteger(parsedPort) || String(parsedPort) !== configuredPort) {
      throw new Error(`PLAYWRIGHT_PREVIEW_PORT must be an integer, got ${configuredPort}`)
    }
    return parsedPort
  }

  const derivedPort = 43_000 + (process.pid % 1_000)
  process.env["PLAYWRIGHT_PREVIEW_PORT"] = String(derivedPort)
  return derivedPort
}
