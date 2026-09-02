import assert from "node:assert/strict"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { createConnection } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { chromium } from "playwright"

const helperPath = join(process.cwd(), "scripts", "audit", "preview-server.mjs")
const bundleHelperPath = join(process.cwd(), "scripts", "audit", "react-scan-bundle.mjs")
const auditScriptPaths = [
  join(process.cwd(), "scripts", "audit", "lighthouse-real-chrome.mjs"),
  join(process.cwd(), "scripts", "audit", "react-scan-lite.mjs"),
]
const reactScanScriptPath = join(process.cwd(), "scripts", "audit", "react-scan-lite.mjs")
const playwrightConfigPath = join(process.cwd(), "playwright.config.ts")

test("audit scripts allocate dynamic preview ports instead of hardcoding 4173", () => {
  for (const scriptPath of auditScriptPaths) {
    const source = readFileSync(scriptPath, "utf8")
    assert.equal(
      source.includes('"4173"') || source.includes("http://127.0.0.1:4173"),
      false,
      `${scriptPath} still hardcodes the shared preview port`,
    )
  }
})

test("react-scan bundling uses esbuild JS API instead of invoking a platform binary with Node", () => {
  const source = readFileSync(reactScanScriptPath, "utf8")

  assert.equal(source.includes('require.resolve("esbuild/bin/esbuild")'), false)
  assert.equal(source.includes("spawnSync"), false)
  assert.match(source, /bundleReactScanLite/)
})

test("react-scan bundle helper creates a browser IIFE exposing instrumentation", {
  skip: !existsSync(bundleHelperPath),
}, async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "react-scan-bundle-"))
  try {
    const bundlePath = join(tempDir, "react-scan-lite.js")
    const { bundleReactScanLite } = await import("./react-scan-bundle.mjs")

    await bundleReactScanLite(bundlePath)

    const bundleSource = readFileSync(bundlePath, "utf8")
    assert.match(bundleSource, /ReactScanLite/)
    assert.match(bundleSource, /instrument/)
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})

test("audit scripts throw from managed preview callbacks instead of exiting immediately", () => {
  for (const scriptPath of auditScriptPaths) {
    const source = readFileSync(scriptPath, "utf8")
    assert.equal(
      source.includes("process.exit("),
      false,
      `${scriptPath} bypasses cleanup with process.exit`,
    )
    assert.match(source, /process\.exitCode/)
  }
})

test("root Playwright config derives its preview port per process or explicit env", () => {
  const source = readFileSync(playwrightConfigPath, "utf8")

  assert.equal(source.includes("4190"), false)
  assert.match(source, /PLAYWRIGHT_PREVIEW_PORT/)
  assert.match(source, /process\.pid/)
  assert.match(source, /process\.env\["PLAYWRIGHT_PREVIEW_PORT"\] = String\(derivedPort\)/)
})

test("preview helper runs two audit previews concurrently without sharing a port", {
  skip: !existsSync(helperPath),
}, async () => {
  const { withPreviewServer } = await import("./preview-server.mjs")
  const servers = await Promise.all([
    withPreviewServer(async (server) => {
      const response = await fetch(server.url)
      return { ok: response.ok, port: server.port }
    }),
    withPreviewServer(async (server) => {
      const response = await fetch(server.url)
      return { ok: response.ok, port: server.port }
    }),
  ])

  assert.equal(servers[0].ok, true)
  assert.equal(servers[1].ok, true)
  assert.notEqual(servers[0].port, servers[1].port)
  assert.equal(await canConnect(servers[0].port), false)
  assert.equal(await canConnect(servers[1].port), false)
})

test("preview helper stops the server when an audit fails after readiness", {
  skip: !existsSync(helperPath),
}, async () => {
  const { withPreviewServer } = await import("./preview-server.mjs")
  let previewPort = 0

  await assert.rejects(
    withPreviewServer(async (server) => {
      previewPort = server.port
      throw new Error("forced audit failure")
    }),
    /forced audit failure/,
  )

  assert.notEqual(previewPort, 0)
  assert.equal(await canConnect(previewPort), false)
})

test("preview and browser ports close when an audit fails after readiness", {
  skip: !existsSync(helperPath),
}, async () => {
  const { allocateLocalhostPort, withPreviewServer } = await import("./preview-server.mjs")
  let browserPort = 0
  let previewPort = 0

  await assert.rejects(
    withPreviewServer(async (server) => {
      previewPort = server.port
      browserPort = await allocateLocalhostPort()
      const browser = await chromium.launch({
        args: [`--remote-debugging-port=${browserPort}`],
        channel: "chrome",
      })
      try {
        assert.equal(await canConnect(browserPort), true)
        throw new Error("forced browser audit failure")
      } finally {
        await browser.close()
      }
    }),
    /forced browser audit failure/,
  )

  assert.notEqual(previewPort, 0)
  assert.notEqual(browserPort, 0)
  assert.equal(await canConnect(previewPort), false)
  assert.equal(await canConnect(browserPort), false)
})

async function canConnect(port) {
  return await new Promise((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port })
    socket.once("connect", () => {
      socket.destroy()
      resolve(true)
    })
    socket.once("error", () => {
      socket.destroy()
      resolve(false)
    })
    socket.setTimeout(500, () => {
      socket.destroy()
      resolve(false)
    })
  })
}
