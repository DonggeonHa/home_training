import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { createConnection } from "node:net"
import { join } from "node:path"
import test from "node:test"

const helperPath = join(process.cwd(), "scripts", "audit", "preview-server.mjs")
const auditScriptPaths = [
  join(process.cwd(), "scripts", "audit", "lighthouse-real-chrome.mjs"),
  join(process.cwd(), "scripts", "audit", "react-scan-lite.mjs"),
]

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
