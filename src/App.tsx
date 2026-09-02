import { Moon } from "@phosphor-icons/react/Moon"
import { Sun } from "@phosphor-icons/react/Sun"
import { useEffect, useLayoutEffect, useState } from "react"
import { createPortal } from "react-dom"
import { AppRoutes, PrimaryNavigation } from "./app/routes"
import { AppStoreProvider, useAppStore } from "./app/store/provider"
import { isThemePreference, resolveMotionClass, resolveReducedMotionPreference } from "./app/theme"
import { Button, Dialog } from "./shared/ui"
import type { StoragePort } from "./storage/ports"
import { BrowserDownloadPort, type DownloadPort } from "./storage/ports"
import "./styles/layout.css"
import "./styles/ui.css"

const skipLinksWithMainFocus = new WeakSet<HTMLAnchorElement>()
let pendingMainFocusObserver: MutationObserver | undefined

type AppProps = {
  readonly downloads?: DownloadPort | undefined
  readonly storage?: StoragePort | undefined
}

export function installMainSkipLink(): void {
  const skipLink = document.querySelector<HTMLAnchorElement>("body > a.skip-link")
  if (skipLink === null || skipLinksWithMainFocus.has(skipLink)) {
    return
  }

  skipLink.addEventListener("click", focusMainFromSkipLink)
  skipLinksWithMainFocus.add(skipLink)
}

export function App({ downloads, storage }: AppProps) {
  return (
    <AppStoreProvider storage={storage}>
      <AppShell downloads={downloads ?? new BrowserDownloadPort()} />
    </AppStoreProvider>
  )
}

function focusMainFromSkipLink(event: Event): void {
  event.preventDefault()
  focusMainLandmark()
}

function focusMainLandmark(): void {
  const main = document.querySelector<HTMLElement>("#main-content")
  if (main !== null) {
    main.focus()
    return
  }

  if (pendingMainFocusObserver !== undefined) {
    return
  }

  const root = document.getElementById("root") ?? document.body
  const observer = new MutationObserver(() => {
    const mountedMain = document.querySelector<HTMLElement>("#main-content")
    if (mountedMain === null) {
      return
    }

    observer.disconnect()
    if (pendingMainFocusObserver === observer) {
      pendingMainFocusObserver = undefined
    }
    mountedMain.focus()
  })
  pendingMainFocusObserver = observer
  observer.observe(root, { childList: true, subtree: true })
}

function AppShell({ downloads }: { readonly downloads: DownloadPort }) {
  const [safetyDialogOpen, setSafetyDialogOpen] = useState(false)
  const [workoutStatus, setWorkoutStatus] = useState("")
  const { actions, state } = useAppStore()
  const motionClass = resolveMotionClass(
    resolveReducedMotionPreference(
      state.display.reducedMotionPreference,
      state.display.prefersReducedMotion,
    ),
  )
  useAppHostAttributes(state.display.resolvedTheme, motionClass)
  useMainSkipLink()

  return (
    <>
      <HeaderActions
        onOpenSafety={() => setSafetyDialogOpen(true)}
        onThemePreferenceChange={actions.setThemePreference}
        themePreference={state.display.themePreference}
      />
      <PrimaryNavigation />
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: main owns the mobile scroll region, so Safari keyboard users need direct focus access. */}
      <main id="main-content" className="app-main" tabIndex={0}>
        <AppRoutes downloads={downloads} onWorkoutCompleted={setWorkoutStatus} />
      </main>
      <p className="sr-only" role="status">
        {workoutStatus}
      </p>
      <Dialog
        onOpenChange={setSafetyDialogOpen}
        open={safetyDialogOpen}
        title="안전 원칙"
        triggerLabel="안전 원칙"
      >
        <ul className="safety-list">
          <li>통증이 있으면 즉시 중단합니다.</li>
          <li>자세가 흐트러지면 반복을 멈춥니다.</li>
          <li>호흡은 천천히 이어갑니다.</li>
        </ul>
      </Dialog>
    </>
  )
}

function HeaderActions({
  onOpenSafety,
  onThemePreferenceChange,
  themePreference,
}: {
  readonly onOpenSafety: () => void
  readonly onThemePreferenceChange: (preference: "system" | "light" | "dark") => void
  readonly themePreference: "system" | "light" | "dark"
}) {
  const actions = (
    <>
      <Button onClick={onOpenSafety} variant="secondary">
        안전 원칙
      </Button>
      <fieldset className="theme-switcher">
        <legend className="sr-only">화면 테마</legend>
        <Sun size={18} weight="duotone" aria-hidden="true" />
        <select
          aria-label="테마 선택"
          onChange={(event) => {
            const nextPreference = event.currentTarget.value
            if (isThemePreference(nextPreference)) {
              onThemePreferenceChange(nextPreference)
            }
          }}
          value={themePreference}
        >
          <option value="system">시스템</option>
          <option value="light">라이트</option>
          <option value="dark">다크</option>
        </select>
        <Moon size={18} weight="duotone" aria-hidden="true" />
      </fieldset>
    </>
  )
  const actionHost = document.getElementById("app-header-actions")

  return actionHost === null ? actions : createPortal(actions, actionHost)
}

function useAppHostAttributes(resolvedTheme: "light" | "dark", motionClass: string): void {
  useEffect(() => {
    const appHost = document.getElementById("app-host")
    if (appHost === null) {
      return
    }

    appHost.setAttribute("data-theme", resolvedTheme)
    appHost.setAttribute("data-testid", "app-shell")
    appHost.classList.toggle("motion-reduce", motionClass === "motion-reduce")
    appHost.classList.toggle("motion-ok", motionClass === "motion-ok")
  }, [motionClass, resolvedTheme])
}

function useMainSkipLink(): void {
  useLayoutEffect(() => installMainSkipLink(), [])
}
