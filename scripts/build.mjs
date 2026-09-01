import { spawnSync } from "node:child_process"
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { basename, join, resolve } from "node:path"

const projectRoot = process.cwd()
const hasNonAsciiPath = Array.from(projectRoot).some((character) => character.charCodeAt(0) > 127)

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
  })

  if (result.status === null) {
    throw new Error(`${command} did not exit cleanly`)
  }

  if (result.status !== 0) {
    process.exit(result.status)
  }
}

function runPnpm(args, cwd) {
  const pnpmExecutable = process.env.npm_execpath

  if (pnpmExecutable === undefined) {
    throw new Error("pnpm executable path was not provided by the package manager")
  }

  run(process.execPath, [pnpmExecutable, ...args], cwd)
}

function runRobocopy(args, stdio = "inherit") {
  const result = spawnSync("robocopy", args, {
    stdio,
  })

  if (result.status === null) {
    throw new Error("robocopy did not exit cleanly")
  }

  if (result.status > 7) {
    process.exit(result.status)
  }
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

function replaceDist(source, destination) {
  if (process.platform === "win32") {
    mkdirSync(destination, { recursive: true })
    runRobocopy([source, destination, "/MIR", "/NFL", "/NDL", "/NJH", "/NJS", "/NP"], "ignore")
    return
  }

  if (existsSync(destination)) {
    rmSync(destination, { recursive: true, force: true })
  }
  cpSync(source, destination, { recursive: true })
}

if (!hasNonAsciiPath) {
  runPnpm(["exec", "vite", "build"], projectRoot)
  process.exit(0)
}

const tempParent = mkdtempSync(resolve(tmpdir(), "home-training-levelup-build-"))
const tempRoot = join(tempParent, "workspace")

mkdirSync(tempParent, { recursive: true })
copyProject(projectRoot, tempRoot)

runPnpm(["install", "--frozen-lockfile"], tempRoot)
runPnpm(["exec", "vite", "build"], tempRoot)
replaceDist(join(tempRoot, "dist"), join(projectRoot, "dist"))

if (process.platform === "win32") {
  const emptyRoot = join(tempParent, "empty")
  mkdirSync(emptyRoot, { recursive: true })
  runRobocopy([emptyRoot, tempRoot, "/MIR", "/NFL", "/NDL", "/NJH", "/NJS", "/NP"], "ignore")
}

rmSync(tempParent, { recursive: true, force: true })
