import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const buildScriptPath = resolve(scriptDirectory, "build.mjs")
const tempPrefix = "home-training-levelup-build-"

function listBuildTempDirectories() {
  return readdirSync(tmpdir(), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(tempPrefix))
    .map((entry) => resolve(tmpdir(), entry.name))
    .sort()
}

function removeDirectoryIfPresent(directory) {
  if (!existsSync(directory)) {
    return
  }

  if (process.platform === "win32") {
    const result = spawnSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        "Remove-Item -LiteralPath $env:BUILD_CLEANUP_TARGET -Recurse -Force",
      ],
      {
        encoding: "utf8",
        env: { ...process.env, BUILD_CLEANUP_TARGET: directory },
      },
    )

    if (result.status !== 0) {
      throw new Error(`Failed to remove test directory ${directory}: ${result.stderr}`)
    }
    return
  }

  rmSync(directory, { recursive: true, force: true })
}

function createFakeProject() {
  const projectRoot = mkdtempSync(join(tmpdir(), "home-training-levelup-nonascii-홈-"))
  writeFileSync(join(projectRoot, "package.json"), '{"type":"module"}\n')
  return projectRoot
}

function createFakePnpm() {
  const fakeRoot = mkdtempSync(join(tmpdir(), "home-training-levelup-fake-pnpm-"))
  const fakePnpmPath = join(fakeRoot, "pnpm.mjs")
  writeFileSync(
    fakePnpmPath,
    [
      'import { appendFileSync, mkdirSync, writeFileSync } from "node:fs"',
      'import { join } from "node:path"',
      "",
      "const args = process.argv.slice(2)",
      "const command = args.join(' ')",
      "appendFileSync(process.env.FAKE_PNPM_LOG, process.cwd() + ' :: ' + args.join(' ') + '\\n')",
      "if (process.env.FAKE_PNPM_MODE === 'hang-exec' && command === 'exec vite build') {",
      "  appendFileSync(process.env.FAKE_PNPM_LOG, 'HANG_READY ' + process.pid + '\\n')",
      "  setInterval(() => {}, 1000)",
      "}",
      "if (process.env.FAKE_PNPM_FAIL_ON && command.includes(process.env.FAKE_PNPM_FAIL_ON)) {",
      "  process.exit(17)",
      "}",
      "if (command === 'exec vite build') {",
      "  mkdirSync('dist', { recursive: true })",
      "  writeFileSync(join('dist', 'index.html'), '<!doctype html><title>fake build</title>')",
      "}",
    ].join("\n"),
  )
  return { fakePnpmPath, fakeRoot }
}

function readLoggedHangPid(logPath) {
  if (!existsSync(logPath)) {
    return undefined
  }

  const match = readFileSync(logPath, "utf8").match(/HANG_READY (?<pid>\d+)/)
  return match?.groups?.pid === undefined ? undefined : Number(match.groups.pid)
}

function terminatePid(pid) {
  if (pid === undefined) {
    return
  }

  try {
    process.kill(pid, "SIGTERM")
  } catch (error) {
    if (error?.code !== "ESRCH") {
      throw error
    }
  }
}

function runBuildWrapper({ extraEnv = {}, failOn, mode, wrapperTimeoutMs } = {}) {
  const projectRoot = createFakeProject()
  const { fakePnpmPath, fakeRoot } = createFakePnpm()
  const before = new Set(listBuildTempDirectories())
  const fakePnpmLogPath = join(projectRoot, "fake-pnpm.log")
  const env = {
    ...process.env,
    ...extraEnv,
    FAKE_PNPM_FAIL_ON: failOn ?? "",
    FAKE_PNPM_MODE: mode ?? "",
    FAKE_PNPM_LOG: fakePnpmLogPath,
    npm_execpath: fakePnpmPath,
  }

  try {
    const result = spawnSync(process.execPath, [buildScriptPath], {
      cwd: projectRoot,
      encoding: "utf8",
      timeout: wrapperTimeoutMs,
      env,
    })
    const leakedDirectories = listBuildTempDirectories().filter(
      (directory) => !before.has(directory),
    )
    const builtDistExists = existsSync(join(projectRoot, "dist", "index.html"))

    return { builtDistExists, leakedDirectories, result }
  } finally {
    terminatePid(readLoggedHangPid(fakePnpmLogPath))
    for (const directory of listBuildTempDirectories()) {
      if (!before.has(directory)) {
        removeDirectoryIfPresent(directory)
      }
    }
    removeDirectoryIfPresent(fakeRoot)
    removeDirectoryIfPresent(projectRoot)
  }
}

function testSuccessfulBuildCleanup() {
  const { builtDistExists, leakedDirectories, result } = runBuildWrapper()

  assert.equal(result.status, 0)
  assert.equal(builtDistExists, true)
  assert.deepEqual(leakedDirectories, [])
}

function testFailedChildCommandCleanup() {
  const { leakedDirectories, result } = runBuildWrapper({ failOn: "exec vite build" })

  assert.equal(result.status, 17)
  assert.deepEqual(leakedDirectories, [])
}

function testHungChildTimeoutCleanup() {
  const { leakedDirectories, result } = runBuildWrapper({
    extraEnv: { BUILD_COMMAND_TIMEOUT_MS: "250" },
    mode: "hang-exec",
    wrapperTimeoutMs: 3000,
  })

  assert.equal(
    result.status,
    124,
    `timeout result status=${result.status} signal=${result.signal} error=${result.error?.code} leaked=${JSON.stringify(leakedDirectories)}`,
  )
  assert.deepEqual(leakedDirectories, [])
}

function testInjectedSignalCleanup(signal, expectedStatus) {
  const { leakedDirectories, result } = runBuildWrapper({
    extraEnv: {
      BUILD_CLEANUP_TEST_SIGNAL: signal,
      BUILD_CLEANUP_TEST_SIGNAL_AFTER_ARGS: "exec vite build",
    },
    mode: "hang-exec",
    wrapperTimeoutMs: 3000,
  })

  assert.equal(
    result.status,
    expectedStatus,
    `${signal} result status=${result.status} signal=${result.signal} error=${result.error?.code} leaked=${JSON.stringify(leakedDirectories)}`,
  )
  assert.deepEqual(leakedDirectories, [])
}

const checks = [
  ["successful build cleanup", testSuccessfulBuildCleanup],
  ["failed child command cleanup", testFailedChildCommandCleanup],
  ["hung child timeout cleanup", testHungChildTimeoutCleanup],
  ["SIGTERM handler cleanup", () => testInjectedSignalCleanup("SIGTERM", 143)],
  ["SIGBREAK handler cleanup", () => testInjectedSignalCleanup("SIGBREAK", 130)],
]

const failures = []
for (const [name, check] of checks) {
  try {
    await check()
  } catch (error) {
    failures.push(new Error(`${name}: ${error.message}`))
  }
}

if (failures.length > 0) {
  throw new AggregateError(failures, "Build cleanup checks failed")
}
