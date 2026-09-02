import { Barbell, Moon, Sun } from "@phosphor-icons/react"
import { useState } from "react"
import { AppRoutes, PrimaryNavigation } from "./app/routes"
import { AppStoreProvider, useAppStore } from "./app/store/provider"
import { isThemePreference, resolveMotionClass, resolveReducedMotionPreference } from "./app/theme"
import { Button, Dialog } from "./shared/ui"
import type { StoragePort } from "./storage/ports"
import { BrowserDownloadPort, type DownloadPort } from "./storage/ports"
import "./styles/layout.css"
import "./styles/ui.css"

type AppProps = {
  readonly downloads?: DownloadPort | undefined
  readonly storage?: StoragePort | undefined
}

export function App({ downloads, storage }: AppProps) {
  return (
    <AppStoreProvider storage={storage}>
      <AppShell downloads={downloads ?? new BrowserDownloadPort()} />
    </AppStoreProvider>
  )
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

  return (
    <>
      {/* biome-ignore lint/a11y/useValidAnchor: skip links are anchors, and the handler repairs browser focus transfer to main. */}
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault()
          document.querySelector<HTMLElement>("#main-content")?.focus()
        }}
      >
        본문으로 건너뛰기
      </a>
      <div
        className={`app-shell ${motionClass}`}
        data-testid="app-shell"
        data-theme={state.display.resolvedTheme}
      >
        <header className="app-header">
          <div className="app-brand">
            <div className="brand-mark" aria-hidden="true">
              <Barbell size={28} weight="duotone" />
            </div>
            <div>
              <p className="eyebrow">초보자 저항운동 성장 시스템</p>
              <span className="brand-title">홈트레이닝 LEVEL UP</span>
            </div>
          </div>
          <div className="app-actions">
            <Button onClick={() => setSafetyDialogOpen(true)} variant="secondary">
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
                    actions.setThemePreference(nextPreference)
                  }
                }}
                value={state.display.themePreference}
              >
                <option value="system">시스템</option>
                <option value="light">라이트</option>
                <option value="dark">다크</option>
              </select>
              <Moon size={18} weight="duotone" aria-hidden="true" />
            </fieldset>
          </div>
        </header>
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
      </div>
    </>
  )
}
