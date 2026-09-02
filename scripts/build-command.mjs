import { spawn } from "node:child_process"

const defaultCommandTimeoutMs = 300_000
const signalExitCodes = {
  SIGBREAK: 130,
  SIGINT: 130,
  SIGTERM: 143,
}

let activeChildProcess
let interruptedSignal

export class CommandExitError extends Error {
  constructor(command, status) {
    super(`${command} exited with status ${status}`)
    this.status = status
  }
}

export class CommandTimeoutError extends Error {
  constructor(command) {
    super(`${command} timed out`)
    this.status = 124
  }
}

export class SignalExitError extends Error {
  constructor(signal) {
    super(`build interrupted by ${signal}`)
    this.status = signalExitCodes[signal]
  }
}

export async function runPnpm(args, cwd) {
  const pnpmExecutable = process.env.npm_execpath

  if (pnpmExecutable === undefined) {
    throw new Error("pnpm executable path was not provided by the package manager")
  }

  await runCommand({ args: [pnpmExecutable, ...args], command: process.execPath, cwd })
}

export async function runRobocopy(args, stdio = "inherit", allowAfterInterrupt = false) {
  await runCommand({
    allowAfterInterrupt,
    args,
    command: "robocopy",
    isSuccessfulStatus: (status) => status <= 7,
    stdio,
  })
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
