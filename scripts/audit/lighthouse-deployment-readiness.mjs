const deployedReadinessTimeoutMs = 120_000

export async function waitForDeployedReadiness(url, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? deployedReadinessTimeoutMs
  const intervalMs = options.intervalMs ?? 1_000
  const htmlUrl = stripHash(url)
  const deadline = Date.now() + timeoutMs
  let lastError = new Error("Deployment readiness was not checked")

  while (Date.now() < deadline) {
    try {
      await assertDeploymentReady(htmlUrl, fetchImpl)
      return
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }

  throw new Error(
    `Timed out waiting for deployed app readiness at ${htmlUrl}: ${lastError.message}`,
  )
}

export function createFetchResponse(options = {}) {
  const headers = new Headers(options.headers ?? { "content-type": "text/html" })
  return {
    headers,
    ok: options.ok ?? true,
    status: options.status ?? 200,
    text: async () => options.body ?? "",
  }
}

async function assertDeploymentReady(htmlUrl, fetchImpl) {
  const response = await fetchImpl(htmlUrl)
  if (!response.ok || response.status !== 200) {
    throw new Error(`Expected HTTP 200 from deployed app, got ${response.status}`)
  }

  const contentType = response.headers.get("content-type") ?? ""
  if (!contentType.includes("text/html")) {
    throw new Error(`Expected deployed app HTML, got content-type ${contentType}`)
  }

  const html = await response.text()
  const requiredMarkers = [
    'id="app-host"',
    'class="app-shell"',
    'class="app-header"',
    "홈트레이닝 LEVEL UP",
  ]
  if (requiredMarkers.some((marker) => !html.includes(marker))) {
    throw new Error("Deployed HTML is missing the expected static app shell")
  }

  const assetUrl = findStaticAssetUrl(html, htmlUrl)
  if (assetUrl === undefined) {
    throw new Error("Deployed HTML is missing a built static asset")
  }

  const assetResponse = await fetchImpl(assetUrl)
  if (!assetResponse.ok || assetResponse.status !== 200) {
    throw new Error(`Expected HTTP 200 from deployed static asset, got ${assetResponse.status}`)
  }
  const assetContentType = assetResponse.headers.get("content-type") ?? ""
  if (!/(javascript|css)/i.test(assetContentType)) {
    throw new Error(`Expected deployed static asset content-type, got ${assetContentType}`)
  }
}

function stripHash(url) {
  const parsed = new URL(url)
  parsed.hash = ""
  return parsed.href
}

function findStaticAssetUrl(html, baseUrl) {
  const match = html.match(/\b(?:src|href)="([^"]*\/assets\/[^"]+\.(?:js|css))"/)
  if (match === null) {
    return undefined
  }
  return new URL(match[1], baseUrl).href
}
