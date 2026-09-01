import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import AxeBuilder from "@axe-core/playwright"
import type { Page, TestInfo } from "@playwright/test"
import { expect, test } from "@playwright/test"

const viewports = [375, 768, 1280] as const
const themes = ["light", "dark"] as const

test("Todo11 dashboard, skill tree, history, and settings are accessible and themed across viewports", async ({
  page,
}, testInfo) => {
  const diagnostics = installPageDiagnostics(page)
  const evidenceDir = path.join(process.cwd(), ".omo", "evidence", "home-training", "task-11")
  await mkdir(evidenceDir, { recursive: true })
  const hashes: Record<string, string> = {}

  for (const width of viewports) {
    for (const theme of themes) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(`/src/features/dashboard/todo11-visual-harness.html?theme=${theme}`, {
        waitUntil: "domcontentloaded",
      })
      const shell = page.locator(".todo11-visual-shell")
      await expect(shell).toHaveAttribute("data-theme", theme)
      await expect(
        page.getByRole("heading", { level: 1, name: "오늘의 진행 대시보드" }),
      ).toBeVisible()
      await expect(page.getByRole("heading", { level: 1, name: "전체 스킬트리" })).toBeVisible()
      await expect(page.getByRole("heading", { level: 1, name: "기록과 성장" })).toBeVisible()
      await expect(page.getByRole("heading", { level: 1, name: "설정과 백업" })).toBeVisible()

      const violations = await new AxeBuilder({ page }).analyze()
      expect(violations.violations).toEqual([])

      const screenshotPath = path.join(evidenceDir, `todo11-${theme}-${width}.png`)
      await page.screenshot({ fullPage: true, path: screenshotPath })
      hashes[`${theme}-${width}`] = createHash("sha256")
        .update(await readFile(screenshotPath))
        .digest("hex")
      await failOnBrowserDiagnostics(diagnostics, testInfo, `${theme}-${width}`)
    }

    expect(hashes[`light-${width}`]).toBeDefined()
    expect(hashes[`dark-${width}`]).toBeDefined()
    expect(hashes[`light-${width}`]).not.toBe(hashes[`dark-${width}`])
  }

  await writeFile(
    path.join(evidenceDir, "todo11-visual-hashes.json"),
    `${JSON.stringify(hashes, null, 2)}\n`,
    "utf8",
  )
})

function installPageDiagnostics(page: Page): string[] {
  const diagnostics: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      const line = `[console:${message.type()}] ${message.text()}`
      diagnostics.push(line)
      console.error(line)
    }
  })
  page.on("pageerror", (error) => {
    const line = `[pageerror] ${error.stack ?? error.message}`
    diagnostics.push(line)
    console.error(line)
  })
  page.on("requestfailed", (request) => {
    const line = `[requestfailed] ${request.method()} ${request.url()} ${
      request.failure()?.errorText ?? "unknown failure"
    }`
    diagnostics.push(line)
    console.error(line)
  })
  return diagnostics
}

async function failOnBrowserDiagnostics(
  diagnostics: readonly string[],
  testInfo: TestInfo,
  label: string,
): Promise<void> {
  if (diagnostics.length === 0) {
    return
  }

  await testInfo.attach(`todo11-browser-diagnostics-${label}`, {
    body: diagnostics.join("\n"),
    contentType: "text/plain",
  })
  throw new Error(`Todo11 browser diagnostics for ${label}:\n${diagnostics.join("\n")}`)
}
