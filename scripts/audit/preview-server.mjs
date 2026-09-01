import { spawn, spawnSync } from "node:child_process"
import { once } from "node:events"
import { mkdirSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { createServer } from "node:net"
import { dirname, join } from "node:path"

const defaultHost = "127.0.0.1"
const defaultTimeoutMs = 30_000
const outputLimit = 16_000
const require = createRequire(import.meta.url)

export async function withPreviewServer(audit, options = {}) {
  const server = await startPreviewServer(options)
  try {
    return await audit(server)
  } finally {
    await server.stop()
  }
}

export async function startPreviewServer(options = {}) {
  const host = options.host ?? defaultHost
  const port = options.port ?? (await allocateLocalhostPort(host))
  const url = `http://${host}:${port}`
  const output = []
  const preview = spawn(process.execPath, createVitePreviewArgs({ host, port }), {
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  })

  collectOutput(preview, output)

  try {
    await waitForPreview({ child: preview, output, timeoutMs: options.timeoutMs, url })
  } catch (error) {
    await stopProcessTree(preview)
    throw error
  }

  return {
    child: preview,
    port,
    stop: () => stopProcessTree(preview),
    url,
  }
}

export async function allocateLocalhostPort(host = defaultHost) {
  const server = createServer()
  await new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, host, resolve)
  })
  const address = server.address()
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error)
        return
      }
      resolve()
    })
  })
  if (address === null || typeof address === "string") {
    throw new Error("Failed to allocate a localhost preview port")
  }
  return address.port
}

export function writeJsonReport(path, value) {
  writeText(path, `${JSON.stringify(value, null, 2)}\n`)
}

export function writeText(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, value, "utf8")
}

async function waitForPreview(options) {
  const timeoutMs = options.timeoutMs ?? defaultTimeoutMs
  await Promise.race([
    waitForHttpOk({ output: options.output, timeoutMs, url: options.url }),
    once(options.child, "exit").then(([code, signal]) => {
      throw new Error(
        `Production preview exited before it was ready with code ${code}, signal ${signal}\n${formatOutput(
          options.output,
        )}`,
      )
    }),
  ])
}

async function waitForHttpOk(options) {
  const deadline = Date.now() + options.timeoutMs
  while (Date.now() < deadline) {
    try {
      const response = await fetch(options.url)
      if (response.ok) {
        return
      }
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(
    `Timed out waiting for production preview at ${options.url}\n${formatOutput(options.output)}`,
  )
}

function createVitePreviewArgs(options) {
  return [
    viteBinPath(),
    "preview",
    "--host",
    options.host,
    "--port",
    String(options.port),
    "--strictPort",
  ]
}

function viteBinPath() {
  return join(dirname(require.resolve("vite/package.json")), "bin", "vite.js")
}

function collectOutput(child, output) {
  const onData = (chunk) => {
    output.push(chunk.toString("utf8"))
    while (output.join("").length > outputLimit) {
      output.shift()
    }
  }
  child.stdout.on("data", onData)
  child.stderr.on("data", onData)
}

function formatOutput(output) {
  const text = output.join("").trim()
  return text.length === 0 ? "<no preview output captured>" : text
}

async function stopProcessTree(processToStop) {
  if (processToStop.exitCode !== null || processToStop.signalCode !== null) {
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
  await Promise.race([stopped, once(AbortSignal.timeout(5_000), "abort")])
}
