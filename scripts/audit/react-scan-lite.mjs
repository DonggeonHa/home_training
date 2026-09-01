import { spawn, spawnSync } from "node:child_process"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { chromium } from "playwright"

const evidenceRoot = join(".omo", "evidence", "home-training", "task-12")
const bundlePath = join(evidenceRoot, "react-scan-lite.js")
const reportPath = join(evidenceRoot, "react-scan-lite-report.json")
const previewUrl = "http://127.0.0.1:4173"
const pnpmExecutable = readPnpmExecutable()

mkdirSync(evidenceRoot, { recursive: true })
run(process.execPath, [
  pnpmExecutable,
  "exec",
  "esbuild",
  "react-scan/lite",
  "--bundle",
  "--format=iife",
  "--global-name=ReactScanLite",
  "--platform=browser",
  `--outfile=${bundlePath}`,
])

const preview = spawn(
  process.execPath,
  [
    pnpmExecutable,
    "exec",
    "vite",
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    "4173",
    "--strictPort",
  ],
  {
    stdio: "ignore",
  },
)

try {
  await waitForPreview()
  const report = await runReactScanAudit()
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8")

  if (!report.instrumented || report.commitEventCount === 0 || report.unnecessaryEventCount > 0) {
    console.error(JSON.stringify(report, null, 2))
    process.exit(1)
  }

  console.log(
    `react-scan/lite gate passed: ${report.commitEventCount} commits, 0 unnecessary; report ${reportPath}`,
  )
} finally {
  await stopProcess(preview)
}

function run(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: "inherit",
  })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function readPnpmExecutable() {
  if (process.env.npm_execpath === undefined) {
    throw new Error("npm_execpath was not provided by pnpm")
  }
  return process.env.npm_execpath
}

async function waitForPreview() {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(previewUrl)
      if (response.ok) {
        return
      }
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error("Timed out waiting for production preview")
}

async function runReactScanAudit() {
  const bundleSource = readFileSync(bundlePath, "utf8")
  const browser = await chromium.launch({ channel: "chrome" })
  const context = await browser.newContext()
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
  await page.waitForTimeout(250)
  const report = await page.evaluate(() => {
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
  await browser.close()
  return report
}

async function stopProcess(processToStop) {
  if (processToStop.exitCode !== null) {
    return
  }

  const stopped = new Promise((resolve) => {
    processToStop.once("exit", resolve)
  })
  if (process.platform === "win32" && processToStop.pid !== undefined) {
    spawnSync("taskkill", ["/pid", String(processToStop.pid), "/t", "/f"], {
      stdio: "ignore",
    })
  } else {
    processToStop.kill("SIGTERM")
  }
  await Promise.race([stopped, new Promise((resolve) => setTimeout(resolve, 5_000))])
}
