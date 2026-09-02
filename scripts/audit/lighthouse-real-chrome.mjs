import { runLighthouseGate } from "./lighthouse-real-chrome-helpers.mjs"

try {
  const result = await runLighthouseGate()
  console.log(`Lighthouse real-Chrome gate passed: ${JSON.stringify(result.summary)}`)
} catch (error) {
  console.error(formatError(error))
  process.exitCode = 1
}

function formatError(error) {
  if (error instanceof Error) {
    return error.stack ?? error.message
  }
  return String(error)
}
