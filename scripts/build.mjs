import { spawn } from "node:child_process"
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { basename, join, resolve } from "node:path"

const projectRoot = process.cwd()
const hasNonAsciiPath = Array.from(projectRoot).some((character) => character.charCodeAt(0) > 127)
const defaultCommandTimeoutMs = 300_000
const signalExitCodes = {
  SIGBREAK: 130,
  SIGINT: 130,
  SIGTERM: 143,
}

let activeChildProcess
let interruptedSignal

class CommandExitError extends Error {
  constructor(command, status) {
    super(`${command} exited with status ${status}`)
    this.status = status
  }
}

class CommandTimeoutError extends Error {
  constructor(command) {
    super(`${command} timed out`)
    this.status = 124
  }
}

class SignalExitError extends Error {
  constructor(signal) {
    super(`build interrupted by ${signal}`)
    this.status = signalExitCodes[signal]
  }
}

function getCommandTimeoutMs() {
  const rawTimeoutMs = process.env.BUILD_COMMAND_TIMEOUT_MS
  if (rawTimeoutMs === undefined) {
    return defaultCommandTimeoutMs
  }

  const timeoutMs = Number(rawTimeoutMs)
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error("BUILD_COMMAND_TIMEOUT_MS must be a positive integer")
  }

  return timeoutMs
}

function handleSignal(signal) {
  interruptedSignal = signal
  if (activeChildProcess !== undefined && activeChildProcess.exitCode === null) {
    activeChildProcess.kill(signal === "SIGBREAK" ? "SIGTERM" : signal)
  }
}

function getInjectedSignal(args) {
  const signal = process.env.BUILD_CLEANUP_TEST_SIGNAL
  if (signal === undefined) {
    return undefined
  }

  if (!Object.hasOwn(signalExitCodes, signal)) {
    throw new Error("BUILD_CLEANUP_TEST_SIGNAL must be SIGBREAK, SIGINT, or SIGTERM")
  }

  const expectedArgs = process.env.BUILD_CLEANUP_TEST_SIGNAL_AFTER_ARGS
  if (expectedArgs === undefined) {
    throw new Error("BUILD_CLEANUP_TEST_SIGNAL_AFTER_ARGS must be provided")
  }

  if (!args.join(" ").endsWith(expectedArgs)) {
    return undefined
  }

  return signal
}

if (process.platform === "win32") {
  process.once("SIGBREAK", () => handleSignal("SIGBREAK"))
}
process.once("SIGINT", () => handleSignal("SIGINT"))
process.once("SIGTERM", () => handleSignal("SIGTERM"))

function runCommand({
  allowAfterInterrupt = false,
  args,
  command,
  cwd,
  isSuccessfulStatus = (status) => status === 0,
  stdio = "inherit",
}) {
  if (!allowAfterInterrupt && interruptedSignal !== undefined) {
    throw new SignalExitError(interruptedSignal)
  }

  const timeoutMs = getCommandTimeoutMs()

  return new Promise((resolvePromise, rejectPromise) => {
    const childProcess = spawn(command, args, { cwd, stdio })
    activeChildProcess = childProcess
    let completed = false
    let timedOut = false
    const injectedSignal = getInjectedSignal(args)

    const finish = (callback) => {
      if (completed) {
        return
      }
      completed = true
      clearTimeout(timeoutTimer)
      clearTimeout(killTimer)
      if (activeChildProcess === childProcess) {
        activeChildProcess = undefined
      }
      callback()
    }

    const timeoutTimer = setTimeout(() => {
      timedOut = true
      childProcess.kill("SIGTERM")
    }, timeoutMs)
    timeoutTimer.unref()

    const killTimer = setTimeout(() => {
      if (timedOut && childProcess.exitCode === null) {
        childProcess.kill("SIGKILL")
      }
    }, timeoutMs + 1000)
    killTimer.unref()

    childProcess.once("error", (error) => {
      finish(() => rejectPromise(error))
    })

    childProcess.once("close", (status, signal) => {
      finish(() => {
        if (!allowAfterInterrupt && interruptedSignal !== undefined) {
          rejectPromise(new SignalExitError(interruptedSignal))
        } else if (timedOut) {
          rejectPromise(new CommandTimeoutError(command))
        } else if (status === null) {
          rejectPromise(new Error(`${command} exited with signal ${signal}`))
        } else if (!isSuccessfulStatus(status)) {
          rejectPromise(new CommandExitError(command, status))
        } else {
          resolvePromise()
        }
      })
    })

    if (injectedSignal !== undefined) {
      setImmediate(() => handleSignal(injectedSignal))
    }
  })
}

async function runPnpm(args, cwd) {
  const pnpmExecutable = process.env.npm_execpath

  if (pnpmExecutable === undefined) {
    throw new Error("pnpm executable path was not provided by the package manager")
  }

  await runCommand({ args: [pnpmExecutable, ...args], command: process.execPath, cwd })
}

async function runRobocopy(args, stdio = "inherit", allowAfterInterrupt = false) {
  await runCommand({
    allowAfterInterrupt,
    args,
    command: "robocopy",
    isSuccessfulStatus: (status) => status <= 7,
    stdio,
  })
}

function copyProject(source, destination) {
  cpSync(source, destination, {
    recursive: true,
    filter: (sourcePath) => {
      const name = basename(sourcePath)
      return name !== ".git" && name !== ".omo" && name !== "node_modules" && name !== "dist"
    },
  })
}

async function replaceDist(source, destination) {
  if (process.platform === "win32") {
    mkdirSync(destination, { recursive: true })
    await runRobocopy(
      [source, destination, "/MIR", "/NFL", "/NDL", "/NJH", "/NJS", "/NP"],
      "ignore",
    )
    return
  }

  if (existsSync(destination)) {
    rmSync(destination, { recursive: true, force: true })
  }
  cpSync(source, destination, { recursive: true })
}

async function cleanupTempParent(tempParent, tempRoot) {
  try {
    if (process.platform === "win32" && existsSync(tempRoot)) {
      const emptyRoot = join(tempParent, "empty")
      mkdirSync(emptyRoot, { recursive: true })
      await runRobocopy(
        [emptyRoot, tempRoot, "/MIR", "/NFL", "/NDL", "/NJH", "/NJS", "/NP"],
        "ignore",
        true,
      )
    }
  } finally {
    rmSync(tempParent, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  }
}

async function main() {
  if (!hasNonAsciiPath) {
    await runPnpm(["exec", "vite", "build"], projectRoot)
    return 0
  }

  const tempParent = mkdtempSync(resolve(tmpdir(), "home-training-levelup-build-"))
  const tempRoot = join(tempParent, "workspace")

  let exitCode = 0
  try {
    mkdirSync(tempParent, { recursive: true })
    copyProject(projectRoot, tempRoot)
    await runPnpm(["install", "--frozen-lockfile"], tempRoot)
    await runPnpm(["exec", "vite", "build"], tempRoot)
    await replaceDist(join(tempRoot, "dist"), join(projectRoot, "dist"))
  } catch (error) {
    if (
      error instanceof CommandExitError ||
      error instanceof CommandTimeoutError ||
      error instanceof SignalExitError
    ) {
      exitCode = error.status
    } else {
      throw error
    }
  } finally {
    await cleanupTempParent(tempParent, tempRoot)
  }

  return exitCode
}

process.exit(await main())
