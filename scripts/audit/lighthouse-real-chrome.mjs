import { mkdirSync } from "node:fs"
import { join } from "node:path"
import lighthouse from "lighthouse"
import desktopConfig from "lighthouse/core/config/desktop-config.js"
import { chromium } from "playwright"
import {
  allocateLocalhostPort,
  withPreviewServer,
  writeJsonReport,
  writeText,
} from "./preview-server.mjs"

const evidenceRoot = join(".omo", "evidence", "home-training", "task-12", "lighthouse")
const categories = ["performance", "accessibility", "best-practices", "seo"]

class LighthouseScoreError extends Error {
  constructor(preset, category, score) {
    super(`${preset} ${category} median was ${score}, expected 100`)
    this.name = "LighthouseScoreError"
    this.category = category
    this.preset = preset
    this.score = score
  }
}

try {
  mkdirSync(evidenceRoot, { recursive: true })
  await withPreviewServer(async (preview) => {
    const auditUrl = `${preview.url}/#/`
    const mobile = await runPreset("mobile", auditUrl)
    const desktop = await runPreset("desktop", auditUrl)
    const summary = { desktop: summarize(desktop), mobile: summarize(mobile) }
    writeJsonReport(join(evidenceRoot, "summary.json"), summary)

    for (const [preset, scores] of Object.entries(summary)) {
      for (const category of categories) {
        if (scores[category] !== 100) {
          throw new LighthouseScoreError(preset, category, scores[category])
        }
      }
    }

    console.log(`Lighthouse real-Chrome gate passed: ${JSON.stringify(summary)}`)
  })
} catch (error) {
  console.error(formatError(error))
  process.exitCode = 1
}

async function runPreset(preset, auditUrl) {
  const runs = []
  for (let index = 1; index <= 3; index += 1) {
    const port = await allocateLocalhostPort()
    const browser = await chromium.launch({
      args: [`--remote-debugging-port=${port}`],
      channel: "chrome",
    })
    try {
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

      if (result === undefined) {
        throw new Error("Lighthouse did not return a result")
      }

      const [jsonReport, htmlReport] = Array.isArray(result.report)
        ? result.report
        : [result.report, ""]
      writeJsonReport(join(evidenceRoot, `${preset}-${index}.json`), JSON.parse(jsonReport))
      writeText(join(evidenceRoot, `${preset}-${index}.html`), htmlReport)
      runs.push(readScores(result.lhr))
    } finally {
      await browser.close()
    }
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

function formatError(error) {
  if (error instanceof Error) {
    return error.stack ?? error.message
  }
  return String(error)
}
