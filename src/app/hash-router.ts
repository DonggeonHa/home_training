import { useSyncExternalStore } from "react"

type NavigateHashOptions = {
  readonly replace?: boolean
}

export function useHashPath(): string {
  return useSyncExternalStore(subscribeToHashPath, readHashPath, () => "/")
}

export function createHashHref(path: string): string {
  return `#${normalizeRoutePath(path)}`
}

export function isHashPathActive(
  currentPath: string,
  routePath: string,
  options: { readonly end?: boolean } = {},
): boolean {
  const normalizedCurrent = normalizeRoutePath(currentPath)
  const normalizedRoute = normalizeRoutePath(routePath)

  if (normalizedRoute === "/") {
    return normalizedCurrent === "/"
  }

  return options.end === true
    ? normalizedCurrent === normalizedRoute
    : normalizedCurrent === normalizedRoute || normalizedCurrent.startsWith(`${normalizedRoute}/`)
}

export function navigateHash(path: string, options: NavigateHashOptions = {}): void {
  const nextHash = createHashHref(path)

  if (window.location.hash === nextHash) {
    return
  }

  if (options.replace === true) {
    window.history.replaceState(null, "", nextHash)
    notifyHashPathChanged()
    return
  }

  window.location.hash = nextHash
}

export function readHashPath(): string {
  const hash = window.location.hash

  if (hash === "" || hash === "#") {
    return "/"
  }

  return normalizeRoutePath(hash.startsWith("#") ? hash.slice(1) : hash)
}

function subscribeToHashPath(onStoreChange: () => void): () => void {
  window.addEventListener("hashchange", onStoreChange)
  window.addEventListener("popstate", onStoreChange)

  return () => {
    window.removeEventListener("hashchange", onStoreChange)
    window.removeEventListener("popstate", onStoreChange)
  }
}

function normalizeRoutePath(path: string): string {
  const pathWithoutSearch = path.trim().split(/[?#]/)[0] ?? ""
  const prefixedPath = pathWithoutSearch.startsWith("/")
    ? pathWithoutSearch
    : `/${pathWithoutSearch}`
  const normalizedPath = prefixedPath.replace(/\/{2,}/g, "/")

  return normalizedPath.length > 1 && normalizedPath.endsWith("/")
    ? normalizedPath.slice(0, -1)
    : normalizedPath
}

function notifyHashPathChanged(): void {
  const event =
    typeof HashChangeEvent === "function"
      ? new HashChangeEvent("hashchange")
      : new Event("hashchange")

  window.dispatchEvent(event)
}
