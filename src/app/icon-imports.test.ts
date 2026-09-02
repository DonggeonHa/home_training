import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { describe, expect, it } from "vitest"

const sourceRoot = "src"
const sourceExtensions = [".ts", ".tsx"] as const
const phosphorPackage = "@phosphor-icons/" + "react"
const routerPackage = "react-router-" + "dom"

describe("critical dependency imports", () => {
  it("keeps Phosphor runtime icons off the package barrel", () => {
    const offenders = sourceFiles(sourceRoot).flatMap((path) =>
      runtimePhosphorBarrelImports(path).map((line) => `${relative(".", path)}:${line}`),
    )

    expect(offenders).toEqual([])
  })

  it("keeps the production app off the React Router runtime bundle", () => {
    const offenders = sourceFiles(sourceRoot).flatMap((path) =>
      runtimeReactRouterImports(path).map((line) => `${relative(".", path)}:${line}`),
    )

    expect(offenders).toEqual([])
  })
})

function sourceFiles(directory: string): readonly string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) {
      return sourceFiles(path)
    }
    return sourceExtensions.some((extension) => path.endsWith(extension)) &&
      !path.endsWith(".test.ts")
      ? [path]
      : []
  })
}

function runtimePhosphorBarrelImports(path: string): readonly number[] {
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .flatMap((line, index) => (isRuntimePhosphorBarrelImport(line) ? [index + 1] : []))
}

function isRuntimePhosphorBarrelImport(line: string): boolean {
  return line.includes(`from "${phosphorPackage}"`) && !line.trimStart().startsWith("import type ")
}

function runtimeReactRouterImports(path: string): readonly number[] {
  if (path.endsWith(".test.tsx") || path.endsWith(".spec.ts")) {
    return []
  }

  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .flatMap((line, index) => (line.includes(`from "${routerPackage}"`) ? [index + 1] : []))
}
