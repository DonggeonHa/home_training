import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { basename, join, resolve } from "node:path"
import {
  CommandExitError,
  CommandTimeoutError,
  runPnpm,
  runRobocopy,
  SignalExitError,
} from "./build-command.mjs"

const projectRoot = process.cwd()
const hasNonAsciiPath = Array.from(projectRoot).some((character) => character.charCodeAt(0) > 127)
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
