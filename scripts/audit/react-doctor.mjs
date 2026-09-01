import { spawnSync } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

const evidencePath = join(
  ".omo",
  "evidence",
  "home-training",
  "task-12",
  "react-doctor-report.json",
)

const result = spawnSync(process.execPath, [pnpmExecutable(), "exec", "react-doctor", "--json"], {
  encoding: "utf8",
})

if (result.error !== undefined) {
  throw result.error
}

const output = `${result.stdout}${result.stderr}`
const report = parseReactDoctorOutput(output)
mkdirSync(dirname(evidencePath), { recursive: true })
writeFileSync(evidencePath, `${JSON.stringify(report, null, 2)}\n`, "utf8")
writeFileSync(".react-doctor-report.json", `${JSON.stringify(report, null, 2)}\n`, "utf8")

const diagnostics = Array.isArray(report.diagnostics) ? report.diagnostics : []
const blockingDiagnostics = diagnostics.filter(
  (diagnostic) =>
    isDiagnostic(diagnostic) &&
    (diagnostic.severity === "error" || diagnostic.category === "Performance"),
)

if (result.status !== 0 || blockingDiagnostics.length > 0) {
  for (const diagnostic of blockingDiagnostics) {
    console.error(
      `${diagnostic.severity} ${diagnostic.category}: ${diagnostic.filePath} ${diagnostic.rule}`,
    )
  }
  process.exit(result.status === 0 ? 1 : (result.status ?? 1))
}

console.log(`react-doctor gate passed: 0 errors, 0 performance warnings; report ${evidencePath}`)

function parseReactDoctorOutput(outputText) {
  const jsonStart = outputText.indexOf("{")
  const jsonEnd = outputText.lastIndexOf("}")
  if (jsonStart < 0 || jsonEnd < jsonStart) {
    throw new Error("react-doctor did not print a JSON report")
  }

  return JSON.parse(outputText.slice(jsonStart, jsonEnd + 1))
}

function isDiagnostic(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof value.severity === "string" &&
    typeof value.category === "string" &&
    typeof value.filePath === "string" &&
    typeof value.rule === "string"
  )
}

function pnpmCommand() {
  return process.env.npm_execpath
}

function pnpmExecutable() {
  const executable = pnpmCommand()
  if (executable === undefined) {
    throw new Error("npm_execpath was not provided by pnpm")
  }
  return executable
}
