import { ClipboardText } from "@phosphor-icons/react/ClipboardText"
import type { Icon } from "@phosphor-icons/react/dist/lib/types"
import { GearSix } from "@phosphor-icons/react/GearSix"
import { House } from "@phosphor-icons/react/House"
import { SneakerMove } from "@phosphor-icons/react/SneakerMove"
import { TreeStructure } from "@phosphor-icons/react/TreeStructure"
import { type ReactElement, Suspense, useEffect } from "react"
import { OnboardingGate } from "../features/onboarding/OnboardingGate"
import type { DownloadPort } from "../storage/ports"
import { createHashHref, isHashPathActive, navigateHash, useHashPath } from "./hash-router"
import {
  DashboardRoute,
  HistoryRoute,
  NotFoundRoute,
  RouteLoading,
  SettingsRoute,
  SkillTreeRoute,
  WorkoutRoute,
} from "./route-pages"

type RouteDefinition = {
  readonly description: string
  readonly href: string
  readonly icon: Icon
  readonly title: string
}

const routes = [
  {
    description: "오늘 할 일을 확인하고 다음 운동을 준비합니다.",
    href: "/",
    icon: House,
    title: "홈",
  },
  {
    description: "세트와 휴식 기록을 남기며 오늘 루틴을 진행합니다.",
    href: "/workout",
    icon: SneakerMove,
    title: "운동",
  },
  {
    description: "레벨별 운동 흐름과 진행 조건을 확인합니다.",
    href: "/levels",
    icon: TreeStructure,
    title: "레벨",
  },
  {
    description: "세트, 반복, 휴식 기록을 남길 화면입니다.",
    href: "/record",
    icon: ClipboardText,
    title: "기록",
  },
  {
    description: "테마, 움직임 줄이기, 백업과 복원을 관리합니다.",
    href: "/settings",
    icon: GearSix,
    title: "설정",
  },
] as const satisfies readonly RouteDefinition[]

export function PrimaryNavigation(): ReactElement {
  const currentPath = useHashPath()

  return (
    <nav className="app-nav" aria-label="주요 메뉴">
      {routes.map((route) => {
        const active = isHashPathActive(currentPath, route.href, { end: route.href === "/" })

        return (
          <a
            aria-current={active ? "page" : undefined}
            className={active ? "app-nav-link active" : "app-nav-link"}
            href={createHashHref(route.href)}
            key={route.href}
          >
            <route.icon size={22} weight="duotone" aria-hidden="true" />
            <span>{route.title}</span>
          </a>
        )
      })}
    </nav>
  )
}

type AppRoutesProps = {
  readonly downloads: DownloadPort
  readonly onWorkoutCompleted: (message: string) => void
}

export function AppRoutes({ downloads, onWorkoutCompleted }: AppRoutesProps): ReactElement {
  const currentPath = useHashPath()

  useEffect(() => {
    if (currentPath === "/plan") {
      navigateHash("/settings", { replace: true })
    }
  }, [currentPath])

  return (
    <OnboardingGate>
      <Suspense fallback={<RouteLoading />}>
        {renderRoute(currentPath, downloads, onWorkoutCompleted)}
      </Suspense>
    </OnboardingGate>
  )
}

function renderRoute(
  path: string,
  downloads: DownloadPort,
  onWorkoutCompleted: (message: string) => void,
): ReactElement {
  switch (path) {
    case "/":
      return <DashboardRoute />
    case "/workout":
      return <WorkoutRoute onWorkoutCompleted={onWorkoutCompleted} />
    case "/record":
      return <HistoryRoute />
    case "/settings":
    case "/plan":
      return <SettingsRoute downloads={downloads} />
    default:
      return renderSkillTreeRoute(path)
  }
}

function renderSkillTreeRoute(path: string): ReactElement {
  if (path === "/levels") {
    return <SkillTreeRoute />
  }

  const categoryMatch = /^\/levels\/([^/]+)$/.exec(path)

  return categoryMatch === null ? (
    <NotFoundRoute />
  ) : (
    <SkillTreeRoute categoryId={categoryMatch[1]} />
  )
}
