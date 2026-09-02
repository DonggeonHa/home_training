import { mkdirSync } from "node:fs"
import { join } from "node:path"
import lighthouse from "lighthouse"
import desktopConfig from "lighthouse/core/config/desktop-config.js"
import { chromium } from "playwright"
import {
  createFetchResponse,
  waitForDeployedReadiness,
} from "./lighthouse-deployment-readiness.mjs"
import {
  allocateLocalhostPort,
  withPreviewServer,
  writeJsonReport,
  writeText,
} from "./preview-server.mjs"

export const categories = ["performance", "accessibility", "best-practices", "seo"]
export { createFetchResponse, waitForDeployedReadiness }

const defaultEvidenceRoot = join(".omo", "evidence", "home-training", "task-12", "lighthouse")
const defaultRunsPerPreset = 3
const maxRunsPerPreset = 5
const deployedReadinessTimeoutMs = 120_000

class LighthouseScoreError extends Error {
  constructor(preset, category, score) {
    super(`${preset} ${category} median was ${score}, expected 100`)
    this.name = "LighthouseScoreError"
    this.category = category
    this.preset = preset
    this.score = score
  }
}

export async function runLighthouseGate(options = {}) {
  const parsed = parseLighthouseArgs(options.argv ?? process.argv.slice(2))
  const deps = createDependencies(options.dependencies)
  deps.mkdirSync(deps.evidenceRoot, { recursive: true })

  if (parsed.deployedUrl !== undefined) {
    await deps.waitForDeployedReadiness(parsed.deployedUrl, {
      fetchImpl: deps.fetchImpl,
      timeoutMs: deployedReadinessTimeoutMs,
    })
    return await runAuditSuite(parsed.deployedUrl, {
      deps,
      runsPerPreset: parsed.runsPerPreset,
    })
  }

  return await deps.withPreviewServer(async (preview) => {
    return await runAuditSuite(`${preview.url}/#/`, {
      deps,
      runsPerPreset: parsed.runsPerPreset,
    })
  })
}

export function parseLighthouseArgs(argv) {
  const args = argv[0] === "--" ? argv.slice(1) : argv
  let deployedUrl
  let runsPerPreset = defaultRunsPerPreset

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === "--url") {
      const value = args[index + 1]
      if (value === undefined || value.startsWith("--")) {
        throw new Error("--url requires an http or https URL")
      }
      deployedUrl = validateDeployedUrl(value)
      index += 1
      continue
    }

    if (arg === "--runs") {
      const value = args[index + 1]
      if (value === undefined || value.startsWith("--")) {
        throw new Error("--runs requires a number between 1 and 5")
      }
      runsPerPreset = parseRuns(value)
      index += 1
      continue
    }

    throw new Error(`Unknown Lighthouse audit argument: ${arg}`)
  }

  return { deployedUrl, runsPerPreset }
}

async function runAuditSuite(auditUrl, options) {
  const mobile = await runPreset("mobile", auditUrl, options)
  const desktop = await runPreset("desktop", auditUrl, options)
  const summary = { desktop: summarize(desktop), mobile: summarize(mobile) }
  options.deps.writeJsonReport(join(options.deps.evidenceRoot, "summary.json"), summary)

  for (const [preset, scores] of Object.entries(summary)) {
    for (const category of categories) {
      if (scores[category] !== 100) {
        throw new LighthouseScoreError(preset, category, scores[category])
      }
    }
  }

  return { auditUrl, summary }
}

async function runPreset(preset, auditUrl, options) {
  const runs = []
  for (let index = 1; index <= options.runsPerPreset; index += 1) {
    const port = await options.deps.allocateLocalhostPort()
    const browser = await options.deps.launchBrowser(port)
    try {
      const result = await options.deps.lighthouseImpl(
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
      options.deps.writeJsonReport(
        join(options.deps.evidenceRoot, `${preset}-${index}.json`),
        JSON.parse(jsonReport),
      )
      options.deps.writeText(join(options.deps.evidenceRoot, `${preset}-${index}.html`), htmlReport)
      runs.push(readScores(result.lhr))
    } finally {
      await browser.close()
    }
  }

  return runs
}

function createDependencies(overrides = {}) {
  return {
    allocateLocalhostPort: overrides.allocateLocalhostPort ?? allocateLocalhostPort,
    evidenceRoot: overrides.evidenceRoot ?? defaultEvidenceRoot,
    fetchImpl: overrides.fetchImpl ?? fetch,
    launchBrowser:
      overrides.launchBrowser ??
      ((port) =>
        chromium.launch({
          args: [`--remote-debugging-port=${port}`],
          channel: "chrome",
        })),
    lighthouseImpl: overrides.lighthouseImpl ?? lighthouse,
    mkdirSync: overrides.mkdirSync ?? mkdirSync,
    waitForDeployedReadiness: overrides.waitForDeployedReadiness ?? waitForDeployedReadiness,
    withPreviewServer: overrides.withPreviewServer ?? withPreviewServer,
    writeJsonReport: overrides.writeJsonReport ?? writeJsonReport,
    writeText: overrides.writeText ?? writeText,
  }
}

function validateDeployedUrl(value) {
  let parsed
  try {
    parsed = new URL(value)
  } catch {
    throw new Error("--url requires a valid http or https URL")
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("--url requires an http or https URL")
  }
  if (parsed.username !== "" || parsed.password !== "") {
    throw new Error("--url must not include credentials")
  }
  return parsed.href
}

function parseRuns(value) {
  if (!/^\d+$/.test(value)) {
    throw new Error("--runs requires a number between 1 and 5")
  }
  const runs = Number(value)
  if (!Number.isInteger(runs) || runs < 1 || runs > maxRunsPerPreset) {
    throw new Error("--runs requires a number between 1 and 5")
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
