import assert from "node:assert/strict"
import test from "node:test"

import {
  createFetchResponse,
  parseLighthouseArgs,
  runLighthouseGate,
  waitForDeployedReadiness,
} from "./lighthouse-real-chrome-helpers.mjs"

test("parser accepts a deployed http or https URL and bounded run count", () => {
  assert.deepEqual(parseLighthouseArgs(["--url", "https://example.test/app/", "--runs", "5"]), {
    deployedUrl: "https://example.test/app/",
    runsPerPreset: 5,
  })
  assert.deepEqual(parseLighthouseArgs(["--", "--url", "https://example.test/app/"]), {
    deployedUrl: "https://example.test/app/",
    runsPerPreset: 3,
  })
  assert.deepEqual(parseLighthouseArgs([]), {
    deployedUrl: undefined,
    runsPerPreset: 3,
  })
})

test("parser rejects unsafe or unsupported URL-mode inputs", () => {
  assert.throws(() => parseLighthouseArgs(["--url", "file:///tmp/index.html"]), /http or https/)
  assert.throws(
    () => parseLighthouseArgs(["--url", "https://user:secret@example.test/"]),
    /credentials/,
  )
  assert.throws(
    () => parseLighthouseArgs(["--url", "https://example.test/", "--runs", "0"]),
    /between 1 and 5/,
  )
  assert.throws(
    () => parseLighthouseArgs(["--url", "https://example.test/", "--unknown"]),
    /Unknown/,
  )
  assert.throws(
    () => parseLighthouseArgs(["--url", "https://example.test/", "--", "--runs", "1"]),
    /Unknown/,
  )
  assert.throws(
    () => parseLighthouseArgs(["--", "--", "--url", "https://example.test/"]),
    /Unknown/,
  )
})

test("deployed readiness requires app shell markers and at least one healthy static asset", async () => {
  const calls = []
  const html = `
    <div id="app-host" class="app-shell">
      <header class="app-header"><h1 class="brand-title">홈트레이닝 LEVEL UP</h1></header>
      <div id="root"></div>
    </div>
    <script type="module" src="/home-training/assets/index-a1b2c3.js"></script>
  `
  const fetchImpl = async (url) => {
    calls.push(String(url))
    if (String(url).endsWith("/assets/index-a1b2c3.js")) {
      return createFetchResponse({
        body: "console.log('app')",
        headers: { "content-type": "application/javascript" },
      })
    }
    return createFetchResponse({ body: html, headers: { "content-type": "text/html" } })
  }

  await waitForDeployedReadiness("https://example.test/home-training/#/", {
    fetchImpl,
    intervalMs: 1,
    timeoutMs: 50,
  })

  assert.deepEqual(calls, [
    "https://example.test/home-training/",
    "https://example.test/home-training/assets/index-a1b2c3.js",
  ])
})

test("URL mode waits for the deployment and bypasses the local preview server", async () => {
  let lighthouseRuns = 0
  let previewStarted = false
  let readinessUrl = ""
  const result = await runLighthouseGate({
    argv: ["--url", "https://example.test/home-training/", "--runs", "1"],
    dependencies: {
      fetchImpl: async () => createFetchResponse({ body: readyHtml() }),
      lighthouseImpl: async () => {
        lighthouseRuns += 1
        return successfulLighthouseResult()
      },
      launchBrowser: async () => ({ close: async () => {} }),
      waitForDeployedReadiness: async (url) => {
        readinessUrl = url
      },
      withPreviewServer: async () => {
        previewStarted = true
        throw new Error("preview should not start")
      },
      writeJsonReport: () => {},
      writeText: () => {},
    },
  })

  assert.equal(previewStarted, false)
  assert.equal(readinessUrl, "https://example.test/home-training/")
  assert.equal(lighthouseRuns, 2)
  assert.equal(result.summary.mobile.performance, 100)
  assert.equal(result.summary.desktop.seo, 100)
})

test("URL mode accepts a leading pnpm separator with one bounded run", async () => {
  let lighthouseRuns = 0
  const result = await runLighthouseGate({
    argv: ["--", "--url", "https://example.test/home-training/", "--runs", "1"],
    dependencies: {
      fetchImpl: async () => createFetchResponse({ body: readyHtml() }),
      lighthouseImpl: async () => {
        lighthouseRuns += 1
        return successfulLighthouseResult()
      },
      launchBrowser: async () => ({ close: async () => {} }),
      waitForDeployedReadiness: async () => {},
      withPreviewServer: async () => {
        throw new Error("preview should not start")
      },
      writeJsonReport: () => {},
      writeText: () => {},
    },
  })

  assert.equal(lighthouseRuns, 2)
  assert.equal(result.summary.mobile.performance, 100)
  assert.equal(result.summary.desktop.performance, 100)
})

test("browser instances close when a URL-mode Lighthouse run fails", async () => {
  let closeCount = 0

  await assert.rejects(
    runLighthouseGate({
      argv: ["--url", "https://example.test/home-training/"],
      dependencies: {
        fetchImpl: async () => createFetchResponse({ body: readyHtml() }),
        lighthouseImpl: async () => {
          throw new Error("forced lighthouse failure")
        },
        launchBrowser: async () => ({
          close: async () => {
            closeCount += 1
          },
        }),
        waitForDeployedReadiness: async () => {},
        withPreviewServer: async () => {
          throw new Error("preview should not start")
        },
        writeJsonReport: () => {},
        writeText: () => {},
      },
    }),
    /forced lighthouse failure/,
  )

  assert.equal(closeCount, 1)
})

function readyHtml() {
  return `
    <div id="app-host" class="app-shell">
      <header class="app-header"><h1 class="brand-title">홈트레이닝 LEVEL UP</h1></header>
      <div id="root"></div>
    </div>
    <script type="module" src="/assets/index-a1b2c3.js"></script>
  `
}

function successfulLighthouseResult() {
  return {
    lhr: {
      categories: {
        accessibility: { score: 1 },
        "best-practices": { score: 1 },
        performance: { score: 1 },
        seo: { score: 1 },
      },
    },
    report: [JSON.stringify({ ok: true }), "<html></html>"],
  }
}
