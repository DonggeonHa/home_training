import { spawn, spawnSync } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import lighthouse from "lighthouse"
import desktopConfig from "lighthouse/core/config/desktop-config.js"
import { chromium } from "playwright"

const evidenceRoot = join(".omo", "evidence", "home-training", "task-12", "lighthouse")
const previewUrl = "http://127.0.0.1:4173"
const auditUrl = `${previewUrl}/#/`
const categories = ["performance", "accessibility", "best-practices", "seo"]
const pnpmExecutable = readPnpmExecutable()

mkdirSync(evidenceRoot, { recursive: true })
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
  const mobile = await runPreset("mobile")
  const desktop = await runPreset("desktop")
  const summary = { desktop: summarize(desktop), mobile: summarize(mobile) }
  writeReport(join(evidenceRoot, "summary.json"), summary)

  for (const [preset, scores] of Object.entries(summary)) {
    for (const category of categories) {
      if (scores[category] !== 100) {
        console.error(`${preset} ${category} median was ${scores[category]}, expected 100`)
        process.exit(1)
      }
    }
  }

  console.log(`Lighthouse real-Chrome gate passed: ${JSON.stringify(summary)}`)
} finally {
  await stopProcess(preview)
}

async function runPreset(preset) {
  const runs = []
  for (let index = 1; index <= 3; index += 1) {
    const port = 9_300 + index + (preset === "desktop" ? 10 : 0)
    const browser = await chromium.launch({
      args: [`--remote-debugging-port=${port}`],
      channel: "chrome",
    })
    const result = await lighthouse(
      auditUrl,
      {
        logLevel: "error",
        onlyCategories: categories,
        output: ["json", "html"],
        port,
      },
      preset === "desktop" ? desktopConfig : createMobileConfig(),
    )
    await browser.close()

    if (result === undefined) {
      throw new Error("Lighthouse did not return a result")
    }

    const [jsonReport, htmlReport] = Array.isArray(result.report)
      ? result.report
      : [result.report, ""]
    writeReport(join(evidenceRoot, `${preset}-${index}.json`), JSON.parse(jsonReport))
    writeText(join(evidenceRoot, `${preset}-${index}.html`), htmlReport)
    runs.push(readScores(result.lhr))
  }

  return runs
}

function createMobileConfig() {
  return {
    extends: "lighthouse:default",
    settings: {
      formFactor: "mobile",
      screenEmulation: { disabled: false, height: 812, mobile: true, width: 375 },
      throttlingMethod: "simulate",
    },
  }
}

function readScores(lhr) {
  return Object.fromEntries(
    categories.map((category) => {
      const score = lhr.categories[category]?.score
      if (typeof score !== "number") {
        throw new Error(`Missing Lighthouse category ${category}`)
      }
      return [category, Math.round(score * 100)]
    }),
  )
}

function summarize(runs) {
  return Object.fromEntries(
    categories.map((category) => [category, median(runs.map((run) => run[category]))]),
  )
}

function median(values) {
  return [...values].sort((left, right) => left - right)[Math.floor(values.length / 2)]
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

function writeReport(path, value) {
  writeText(path, `${JSON.stringify(value, null, 2)}\n`)
}

function writeText(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, value, "utf8")
}

function readPnpmExecutable() {
  if (process.env.npm_execpath === undefined) {
    throw new Error("npm_execpath was not provided by pnpm")
  }
  return process.env.npm_execpath
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
