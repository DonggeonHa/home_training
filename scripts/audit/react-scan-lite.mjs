import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { chromium } from "playwright"
import { withPreviewServer } from "./preview-server.mjs"
import { bundleReactScanLite } from "./react-scan-bundle.mjs"

const evidenceRoot = join(".omo", "evidence", "home-training", "task-12")
const bundlePath = join(evidenceRoot, "react-scan-lite.js")
const reportPath = join(evidenceRoot, "react-scan-lite-report.json")

mkdirSync(evidenceRoot, { recursive: true })
await bundleReactScanLite(bundlePath)

await withPreviewServer(async (preview) => {
  const report = await runReactScanAudit(preview.url)
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8")

  if (!report.instrumented || report.commitEventCount === 0 || report.unnecessaryEventCount > 0) {
    console.error(JSON.stringify(report, null, 2))
    process.exit(1)
  }

  console.log(
    `react-scan/lite gate passed: ${report.commitEventCount} commits, 0 unnecessary; report ${reportPath}`,
  )
})

async function runReactScanAudit(previewUrl) {
  const bundleSource = readFileSync(bundlePath, "utf8")
  const browser = await chromium.launch({ channel: "chrome" })
  try {
    const context = await browser.newContext()
    try {
      await context.addInitScript(`${bundleSource}
;(() => {
  window.__homeTrainingReactScanEvents = [];
  window.__homeTrainingReactScanInstrumented = false;
  ReactScanLite.instrument({
    includeFiberIdentity: true,
    includeFiberSource: true,
    onEvent(event) {
      if (event.kind === "commit") {
        window.__homeTrainingReactScanEvents.push(event);
      }
    },
    recordChangeDescriptions: true,
  });
  window.__homeTrainingReactScanInstrumented = true;
})();`)
      const page = await context.newPage()
      await page.goto(`${previewUrl}/#/`)
      await page.getByRole("link", { name: "운동" }).click()
      await page.getByRole("button", { name: "안전 원칙" }).click()
      await page.getByRole("button", { exact: true, name: "닫기" }).click()
      await page.getByRole("link", { name: "기록" }).click()
      await page.getByRole("link", { name: "설정" }).click()
      await waitForCommitEvents(page)
      return await page.evaluate(() => {
        const events = window.__homeTrainingReactScanEvents ?? []
        return {
          commitEventCount: events.length,
          instrumented: window.__homeTrainingReactScanInstrumented === true,
          unnecessaryEventCount: events.filter(hasUnnecessaryRender).length,
        }

        function hasUnnecessaryRender(event) {
          return JSON.stringify(event).includes('"unnecessary"')
        }
      })
    } finally {
      await context.close()
    }
  } finally {
    await browser.close()
  }
}

async function waitForCommitEvents(page) {
  await page.waitForFunction(
    () => (window.__homeTrainingReactScanEvents?.length ?? 0) > 0,
    undefined,
    {
      timeout: 5_000,
    },
  )
}
