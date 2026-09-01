import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

const viewports = [375, 768, 1280] as const
const themes = ["light", "dark"] as const

test("Todo11 dashboard, skill tree, history, and settings are accessible and themed across viewports", async ({
  page,
}) => {
  const evidenceDir = path.join(process.cwd(), ".omo", "evidence", "home-training", "task-11")
  await mkdir(evidenceDir, { recursive: true })
  const hashes: Record<string, string> = {}

  for (const width of viewports) {
    for (const theme of themes) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(`/src/features/dashboard/todo11-visual-harness.html?theme=${theme}`)
      await expect(page.locator(".todo11-visual-shell")).toHaveAttribute("data-theme", theme)
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
