import { spawnSync } from "node:child_process"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { join } from "node:path"
import { chromium } from "playwright"
import { withPreviewServer } from "./preview-server.mjs"

const evidenceRoot = join(".omo", "evidence", "home-training", "task-12")
const bundlePath = join(evidenceRoot, "react-scan-lite.js")
const reportPath = join(evidenceRoot, "react-scan-lite-report.json")
const require = createRequire(import.meta.url)

mkdirSync(evidenceRoot, { recursive: true })
run(process.execPath, [
  require.resolve("esbuild/bin/esbuild"),
  "react-scan/lite",
  "--bundle",
  "--format=iife",
  "--global-name=ReactScanLite",
  "--platform=browser",
  `--outfile=${bundlePath}`,
])

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

function run(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: "inherit",
  })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

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
